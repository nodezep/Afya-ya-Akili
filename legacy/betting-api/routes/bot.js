const express = require('express');
const router = express.Router();
const axios = require('axios');
const supabase = require('../config/supabase');
const { hasUserUnlocked } = require('../services/payment');

// ============================================
// WhatsApp Cloud API (Meta) Integration
// ============================================

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const sendWhatsAppMessage = async (to, message) => {
  try {
    await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('WhatsApp send error:', error.response?.data || error.message);
  }
};

// Send interactive button message
const sendInteractiveMessage = async (to, body, buttons) => {
  try {
    await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.map((btn, i) => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.title },
            })),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('WhatsApp interactive error:', error.response?.data || error.message);
  }
};

// Format bet slip for WhatsApp
const formatBetSlipMessage = (betSlip, locked = true) => {
  const confidence = { LOW: '🟡', MEDIUM: '🟠', HIGH: '🔴', VERY_HIGH: '🔥' };
  const icon = confidence[betSlip.confidence_level] || '⚽';

  if (locked) {
    return `🔒 *${betSlip.title || "Today's Bet Slip"}*

📅 Date: ${betSlip.date}
${icon} Confidence: ${betSlip.confidence_level}
📊 Total Odds: *${betSlip.total_odds}x*
⚽ Matches: ${betSlip.match_count || '3'} games

🔐 *Unlock for TZS 1,000*

Reply *PAY* to unlock today's full predictions!
Or visit: https://betvision.tz/today`;
  }

  const matchLines = betSlip.matches?.map((m, i) => {
    const pred = betSlip.predictions?.[i];
    const odd = betSlip.odds?.[i];
    return `${i + 1}. ${m.home} vs ${m.away}
   🏆 ${m.league} | ⏰ ${m.time}
   ✅ Pick: *${pred?.pick}*
   📊 Odds: ${odd}x (${pred?.confidence}% confidence)`;
  }).join('\n\n') || '';

  return `🎯 *${betSlip.title || "Today's Bet Slip"}*
📅 ${betSlip.date} | ${icon} ${betSlip.confidence_level} Confidence

${matchLines}

━━━━━━━━━━━━━━
💰 *Total Odds: ${betSlip.total_odds}x*
━━━━━━━━━━━━━━

⚠️ _Bet responsibly. 18+ only._
🌐 betvision.tz`;
};

// ============================================
// Webhook Verification (Meta)
// ============================================
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// ============================================
// Incoming Message Handler
// ============================================
router.post('/webhook', async (req, res) => {
  // Acknowledge immediately
  res.sendStatus(200);

  try {
    const body = req.body;
    if (!body.object || !body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) return;

    const value = body.entry[0].changes[0].value;
    const message = value.messages[0];
    const contact = value.contacts?.[0];

    const from = message.from; // WhatsApp number
    const displayName = contact?.profile?.name || 'Friend';
    const msgType = message.type;

    // Get message text
    let userMessage = '';
    if (msgType === 'text') {
      userMessage = message.text.body.trim().toUpperCase();
    } else if (msgType === 'interactive') {
      userMessage = message.interactive?.button_reply?.id?.toUpperCase() || '';
    }

    // Register/update bot user
    await supabase.from('bot_users').upsert(
      { phone: from, whatsapp_id: from, display_name: displayName, last_interaction: new Date().toISOString() },
      { onConflict: 'phone', ignoreDuplicates: false }
    );

    // Increment message count
    await supabase.rpc('increment', { row_id: from }).catch(() => null);

    // ============================================
    // Command Routing
    // ============================================
    const today = new Date().toISOString().split('T')[0];

    if (['HI', 'HELLO', 'HABARI', 'HUJAMBO', 'START', 'MENU'].includes(userMessage)) {
      await sendInteractiveMessage(
        from,
        `🏆 *Karibu BetVision TZ!*\n\nHello ${displayName}! 👋\n\nNinakuletea predictions bora za leo!\nUnachagua uchezaji wa leo?`,
        [
          { id: 'TODAY', title: "📊 Leo's Tips" },
          { id: 'HISTORY', title: '📈 Historia' },
          { id: 'HELP', title: '❓ Msaada' },
        ]
      );
    } else if (['TODAY', 'TIPS', 'LEO', 'PREDICTIONS', 'SLIP'].includes(userMessage)) {
      // Fetch today's bet slip
      const { data: betSlip } = await supabase
        .from('bet_slips')
        .select('*')
        .eq('date', today)
        .eq('is_published', true)
        .single();

      if (!betSlip) {
        await sendWhatsAppMessage(from, `⏳ Predictions za leo hazijawekwa bado.\n\nTuma *MENU* kurudi nyuma.`);
        return;
      }

      // Check if user has a registered account and unlocked
      const { data: user } = await supabase.from('users').select('id').eq('phone', `+${from}`).single();
      let isUnlocked = false;
      if (user) {
        isUnlocked = await hasUserUnlocked(user.id, today);
      }

      const msg = formatBetSlipMessage(
        isUnlocked ? betSlip : { ...betSlip, match_count: betSlip.matches?.length },
        !isUnlocked
      );
      await sendWhatsAppMessage(from, msg);
    } else if (['HISTORY', 'HISTORIA', 'PAST'].includes(userMessage)) {
      const { data: slips } = await supabase
        .from('bet_slips')
        .select('date, title, total_odds, result, confidence_level')
        .eq('is_published', true)
        .lt('date', today)
        .order('date', { ascending: false })
        .limit(5);

      if (!slips?.length) {
        await sendWhatsAppMessage(from, '📂 Hakuna historia bado.\n\nTuma *MENU* kurudi.');
        return;
      }

      const resultEmoji = { WIN: '✅', LOSS: '❌', PENDING: '⏳', VOID: '⚪' };
      const historyText = slips.map(s =>
        `📅 ${s.date} | ${resultEmoji[s.result] || '⏳'} ${s.result}\n💰 Odds: ${s.total_odds}x`
      ).join('\n\n');

      await sendWhatsAppMessage(from, `📊 *Historia ya Slips (Hivi Karibuni)*\n\n${historyText}\n\n🌐 Tazama zaidi: betvision.tz/history`);
    } else if (['PAY', 'LIPA', 'UNLOCK', 'FUNGUA'].includes(userMessage)) {
      await sendWhatsAppMessage(
        from,
        `💳 *Jinsi ya Kufungua Predictions*\n\n1️⃣ Nenda: *https://betvision.tz/pay*\n2️⃣ Ingiza namba yako ya simu\n3️⃣ Lipia TZS 1,000 kwa M-Pesa/Airtel/Tigo\n4️⃣ Unapata predictions zote mara moja!\n\n⚡ Muda: Chini ya dakika 1\n🔒 Malipo salama kabisa`
      );
    } else if (['HELP', 'MSAADA', '?'].includes(userMessage)) {
      await sendWhatsAppMessage(
        from,
        `❓ *BetVision TZ - Amri*\n\n📊 *LEO* - Predictions za leo\n📈 *HISTORIA* - Slips zilizopita\n💳 *LIPA* - Jinsi ya kulipa\n🏠 *MENU* - Menyu kuu\n\n🌐 Tovuti: betvision.tz\n📧 Mawasiliano: support@betvision.tz`
      );
    } else {
      await sendInteractiveMessage(
        from,
        `Samahani, sijaelewa. Chagua kutoka hapa chini:`,
        [
          { id: 'TODAY', title: "📊 Leo's Tips" },
          { id: 'PAY', title: '💳 Lipa Sasa' },
          { id: 'HELP', title: '❓ Msaada' },
        ]
      );
    }
  } catch (error) {
    console.error('Bot webhook error:', error);
  }
});

module.exports = router;
