// src/Support.jsx
// Always-reachable help page. IMPORTANT: the contacts below are
// PLACEHOLDERS. Replace them with numbers you have personally
// verified for Tanzania before showing this to real users —
// a wrong number during a crisis causes real harm.

const TEXT = {
  en: {
    title: 'Get support now',
    notEmergency:
      'Akili is a supportive tool, not emergency care. If you are in danger or thinking of harming yourself, please contact:',
    contacts: [
      { label: 'Emergency services (police/ambulance)', value: '[VERIFY: e.g. 112 in Tanzania]' },
      { label: 'Mental health helpline', value: '[VERIFY: add a confirmed Tanzanian helpline]' },
      { label: 'Nearest hospital', value: '[VERIFY: add regional referral hospital]' },
    ],
    trusted:
      'It also helps to reach out to one person you trust — a friend, family member, religious leader, or teacher.',
  },
  sw: {
    title: 'Pata msaada sasa',
    notEmergency:
      'Akili ni chombo cha kusaidia, si huduma ya dharura. Ukiwa hatarini au una mawazo ya kujidhuru, tafadhali wasiliana na:',
    contacts: [
      { label: 'Huduma za dharura (polisi/gari la wagonjwa)', value: '[THIBITISHA: mf. 112 Tanzania]' },
      { label: 'Simu ya msaada wa afya ya akili', value: '[THIBITISHA: weka namba iliyothibitishwa]' },
      { label: 'Hospitali iliyo karibu', value: '[THIBITISHA: weka hospitali ya rufaa ya mkoa]' },
    ],
    trusted:
      'Pia inasaidia kuwasiliana na mtu mmoja unayemwamini — rafiki, ndugu, kiongozi wa dini, au mwalimu.',
  },
}

export function Support({ language = 'en' }) {
  const t = TEXT[language] ?? TEXT.en

  return (
    <section aria-label={t.title}>
      <h2>{t.title}</h2>
      <p>{t.notEmergency}</p>
      <ul>
        {t.contacts.map((contact) => (
          <li key={contact.label}>
            <strong>{contact.label}:</strong> {contact.value}
          </li>
        ))}
      </ul>
      <p>{t.trusted}</p>
    </section>
  )
}
