/* eslint-disable no-console */
import { PrismaClient, AssessmentType, PlanTier, Role, TherapistStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PHQ9_OPTIONS = [
  { label: 'Not at all', value: 0 },
  { label: 'Several days', value: 1 },
  { label: 'More than half the days', value: 2 },
  { label: 'Nearly every day', value: 3 },
];

const PSS_OPTIONS = [
  { label: 'Never', value: 0 },
  { label: 'Almost never', value: 1 },
  { label: 'Sometimes', value: 2 },
  { label: 'Fairly often', value: 3 },
  { label: 'Very often', value: 4 },
];

const WHO5_OPTIONS = [
  { label: 'At no time', value: 0 },
  { label: 'Some of the time', value: 1 },
  { label: 'Less than half of the time', value: 2 },
  { label: 'More than half of the time', value: 3 },
  { label: 'Most of the time', value: 4 },
  { label: 'All of the time', value: 5 },
];

const ASSESSMENTS: Array<{
  type: AssessmentType;
  name: string;
  description: string;
  options: Array<{ label: string; value: number }>;
  questions: string[];
}> = [
  {
    type: AssessmentType.PHQ9,
    name: 'PHQ-9 Depression Screening',
    description:
      'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
    options: PHQ9_OPTIONS,
    questions: [
      'Little interest or pleasure in doing things',
      'Feeling down, depressed, or hopeless',
      'Trouble falling or staying asleep, or sleeping too much',
      'Feeling tired or having little energy',
      'Poor appetite or overeating',
      'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
      'Trouble concentrating on things, such as reading the newspaper or watching television',
      'Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
      'Thoughts that you would be better off dead, or of hurting yourself in some way',
    ],
  },
  {
    type: AssessmentType.GAD7,
    name: 'GAD-7 Anxiety Screening',
    description:
      'Over the last 2 weeks, how often have you been bothered by the following problems?',
    options: PHQ9_OPTIONS,
    questions: [
      'Feeling nervous, anxious, or on edge',
      'Not being able to stop or control worrying',
      'Worrying too much about different things',
      'Trouble relaxing',
      'Being so restless that it is hard to sit still',
      'Becoming easily annoyed or irritable',
      'Feeling afraid, as if something awful might happen',
    ],
  },
  {
    type: AssessmentType.PSS10,
    name: 'PSS-10 Perceived Stress Scale',
    description: 'The questions ask about your feelings and thoughts during the last month.',
    options: PSS_OPTIONS,
    questions: [
      'In the last month, how often have you been upset because of something that happened unexpectedly?',
      'In the last month, how often have you felt that you were unable to control the important things in your life?',
      'In the last month, how often have you felt nervous and stressed?',
      'In the last month, how often have you felt confident about your ability to handle your personal problems?',
      'In the last month, how often have you felt that things were going your way?',
      'In the last month, how often have you found that you could not cope with all the things that you had to do?',
      'In the last month, how often have you been able to control irritations in your life?',
      'In the last month, how often have you felt that you were on top of things?',
      'In the last month, how often have you been angered because of things that happened that were outside of your control?',
      'In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?',
    ],
  },
  {
    type: AssessmentType.WHO5,
    name: 'WHO-5 Wellbeing Index',
    description: 'Please indicate for each of the five statements which is closest to how you have been feeling over the last two weeks.',
    options: WHO5_OPTIONS,
    questions: [
      'I have felt cheerful and in good spirits',
      'I have felt calm and relaxed',
      'I have felt active and vigorous',
      'I woke up feeling fresh and rested',
      'My daily life has been filled with things that interest me',
    ],
  },
];

const MEDITATIONS = [
  { title: 'Morning Calm', category: 'focus', durationSec: 600, description: 'Start your day grounded with a 10-minute guided breathing practice.', narrator: 'Amani K.' },
  { title: 'Deep Sleep Journey', category: 'sleep', durationSec: 1200, description: 'A 20-minute body scan to help you drift into restful sleep.', narrator: 'Zawadi M.' },
  { title: 'Anxiety Relief Breathwork', category: 'anxiety', durationSec: 480, description: 'Box breathing and grounding for moments of acute anxiety.', narrator: 'Amani K.' },
  { title: 'Loving Kindness', category: 'compassion', durationSec: 900, description: 'Cultivate warmth toward yourself and others with metta meditation.', narrator: 'Neema W.' },
  { title: '5-Minute Reset', category: 'focus', durationSec: 300, description: 'A quick mindfulness reset for a busy workday.', narrator: 'Zawadi M.' },
  { title: 'Stress Melt', category: 'stress', durationSec: 720, description: 'Progressive muscle relaxation to release tension held in the body.', narrator: 'Neema W.', isPremium: true },
];

const KNOWLEDGE_DOCS = [
  {
    title: 'Grounding techniques for anxiety',
    category: 'coping-skills',
    content:
      'Grounding techniques help interrupt spiralling anxious thoughts by anchoring attention in the present moment. ' +
      'The 5-4-3-2-1 technique: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and 1 you can taste. ' +
      'Box breathing: inhale for 4 counts, hold for 4, exhale for 4, hold for 4, and repeat for at least four cycles. ' +
      'Temperature change, such as holding an ice cube or splashing cold water on the face, activates the dive reflex and slows heart rate. ' +
      'These techniques are most effective when practised regularly, not only during moments of panic.',
  },
  {
    title: 'Understanding depression',
    category: 'psychoeducation',
    content:
      'Depression is more than sadness: it is a persistent low mood or loss of interest lasting two weeks or longer, ' +
      'often accompanied by changes in sleep, appetite, energy, concentration, and self-worth. ' +
      'It is a medical condition, not a personal failing, and it is treatable. Evidence-based treatments include ' +
      'cognitive behavioural therapy (CBT), behavioural activation, interpersonal therapy, and medication. ' +
      'Small consistent actions — a short walk, a regular sleep schedule, reaching out to one trusted person — measurably improve outcomes. ' +
      'If you have thoughts of harming yourself, contact emergency services or a crisis line immediately: in Kenya, call the Befrienders Kenya line +254 722 178 177.',
  },
  {
    title: 'Sleep hygiene basics',
    category: 'psychoeducation',
    content:
      'Good sleep is foundational to mental health. Keep a consistent sleep and wake time, including weekends. ' +
      'Avoid caffeine after mid-afternoon and screens for the last hour before bed. Keep the bedroom dark, quiet, and cool. ' +
      'If you cannot fall asleep within 20 minutes, get up and do something calm in dim light until sleepy. ' +
      'Reserve the bed for sleep so the brain associates it with rest. Persistent insomnia responds well to CBT-I, ' +
      'a structured programme more effective long-term than sleep medication.',
  },
  {
    title: 'Cognitive distortions and how to challenge them',
    category: 'coping-skills',
    content:
      'Cognitive distortions are habitual thinking errors that fuel low mood and anxiety. Common ones include ' +
      'all-or-nothing thinking ("If I fail this exam, my life is over"), catastrophising, mind-reading, and overgeneralisation. ' +
      'To challenge a distortion: write the thought down, identify the distortion, list evidence for and against it, ' +
      'and craft a balanced alternative thought. Ask: what would I tell a friend who had this thought? ' +
      'This is the core skill of cognitive behavioural therapy and improves with daily practice.',
  },
];

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  console.log('Seeding AKILI database...');

  // ---- Plans ----
  const plans = [
    {
      tier: PlanTier.FREE,
      name: 'Free',
      description: 'Core wellbeing tools for everyone',
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      features: ['AI chat (20 messages/day)', 'Mood tracker', 'Journal', 'Basic meditations', 'Self assessments'],
    },
    {
      tier: PlanTier.PREMIUM,
      name: 'Premium',
      description: 'Unlimited AI support and the full content library',
      priceMonthlyCents: 99900,
      priceYearlyCents: 999000,
      features: ['Unlimited AI chat', 'Full meditation library', 'All courses', 'Priority booking', 'Advanced analytics'],
    },
    {
      tier: PlanTier.CORPORATE,
      name: 'Corporate',
      description: 'Team wellbeing with anonymised organisational insights',
      priceMonthlyCents: 79900,
      priceYearlyCents: 799000,
      features: ['Everything in Premium', 'Corporate dashboard', 'Anonymised team insights', 'Dedicated support', 'Custom onboarding'],
    },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { tier: plan.tier },
      update: plan,
      create: plan,
    });
  }
  console.log('  plans ✔');

  // ---- Users ----
  const password = await bcrypt.hash('Akili@2026', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@akili.health' },
    update: {},
    create: {
      email: 'superadmin@akili.health',
      passwordHash: password,
      role: Role.SUPER_ADMIN,
      emailVerifiedAt: new Date(),
      profile: { create: { firstName: 'Super', lastName: 'Admin', country: 'KE' } },
      preferences: { create: {} },
    },
  });
  await prisma.user.upsert({
    where: { email: 'admin@akili.health' },
    update: {},
    create: {
      email: 'admin@akili.health',
      passwordHash: password,
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
      profile: { create: { firstName: 'Akili', lastName: 'Admin', country: 'KE' } },
      preferences: { create: {} },
    },
  });
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@akili.health' },
    update: {},
    create: {
      email: 'demo@akili.health',
      passwordHash: password,
      role: Role.USER,
      emailVerifiedAt: new Date(),
      profile: { create: { firstName: 'Demo', lastName: 'User', country: 'KE', city: 'Nairobi' } },
      preferences: { create: {} },
    },
  });
  console.log('  users ✔');

  // ---- Therapists ----
  const therapistSeed = [
    { email: 'dr.wanjiku@akili.health', first: 'Grace', last: 'Wanjiku', title: 'Clinical Psychologist', specialties: ['anxiety', 'depression', 'trauma'], years: 12, rate: 450000 },
    { email: 'dr.otieno@akili.health', first: 'David', last: 'Otieno', title: 'Counselling Psychologist', specialties: ['relationships', 'stress', 'grief'], years: 8, rate: 350000 },
    { email: 'dr.njeri@akili.health', first: 'Sarah', last: 'Njeri', title: 'Psychiatrist', specialties: ['depression', 'bipolar', 'medication-management'], years: 15, rate: 600000 },
  ];
  for (const t of therapistSeed) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        email: t.email,
        passwordHash: password,
        role: Role.THERAPIST,
        emailVerifiedAt: new Date(),
        profile: { create: { firstName: t.first, lastName: t.last, country: 'KE', city: 'Nairobi' } },
        preferences: { create: {} },
      },
    });
    const tp = await prisma.therapistProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        title: t.title,
        licenseNumber: `KE-PSY-${1000 + t.years}`,
        licenseBody: 'Kenya Counselling and Psychological Association',
        yearsExperience: t.years,
        specialties: t.specialties,
        languages: ['en', 'sw'],
        about: `${t.first} ${t.last} is a ${t.title.toLowerCase()} with ${t.years} years of experience helping clients with ${t.specialties.join(', ')}.`,
        hourlyRateCents: t.rate,
        status: TherapistStatus.APPROVED,
      },
    });
    // Weekday availability 9:00 - 17:00
    for (const day of [1, 2, 3, 4, 5]) {
      const existing = await prisma.availabilitySlot.findFirst({ where: { therapistId: tp.id, dayOfWeek: day } });
      if (!existing) {
        await prisma.availabilitySlot.create({
          data: { therapistId: tp.id, dayOfWeek: day, startTime: '09:00', endTime: '17:00' },
        });
      }
    }
  }
  console.log('  therapists ✔');

  // ---- Assessments ----
  for (const a of ASSESSMENTS) {
    const template = await prisma.assessmentTemplate.upsert({
      where: { type: a.type },
      update: { name: a.name, description: a.description },
      create: { type: a.type, name: a.name, description: a.description },
    });
    for (let i = 0; i < a.questions.length; i++) {
      await prisma.assessmentQuestion.upsert({
        where: { templateId_order: { templateId: template.id, order: i + 1 } },
        update: { text: a.questions[i], options: a.options },
        create: { templateId: template.id, order: i + 1, text: a.questions[i], options: a.options },
      });
    }
  }
  console.log('  assessments ✔');

  // ---- Meditations ----
  for (const m of MEDITATIONS) {
    const existing = await prisma.meditation.findFirst({ where: { title: m.title } });
    if (!existing) {
      await prisma.meditation.create({
        data: {
          title: m.title,
          description: m.description,
          category: m.category,
          durationSec: m.durationSec,
          narrator: m.narrator,
          isPremium: (m as { isPremium?: boolean }).isPremium ?? false,
          audioUrl: `https://cdn.akili.health/meditations/${slugify(m.title)}.mp3`,
          imageUrl: `https://cdn.akili.health/meditations/${slugify(m.title)}.jpg`,
        },
      });
    }
  }
  console.log('  meditations ✔');

  // ---- Courses ----
  const courses = [
    {
      title: 'Foundations of Emotional Wellbeing',
      category: 'basics',
      description: 'Understand emotions, stress responses, and the habits that build resilience.',
      lessons: [
        'What emotions are for',
        'The stress response explained',
        'Building a daily wellbeing routine',
        'When and how to seek help',
      ],
    },
    {
      title: 'Managing Anxiety with CBT',
      category: 'anxiety',
      description: 'Practical cognitive behavioural techniques you can apply the same day.',
      lessons: [
        'How anxiety works in the brain and body',
        'Spotting cognitive distortions',
        'Thought records step by step',
        'Gradual exposure done safely',
        'Relapse prevention',
      ],
    },
    {
      title: 'Better Sleep in 7 Days',
      category: 'sleep',
      description: 'A one-week programme based on CBT-I to reset your sleep.',
      lessons: [
        'Your sleep drive and body clock',
        'The stimulus control method',
        'Wind-down routines that work',
        'Handling middle-of-the-night waking',
      ],
    },
  ];
  for (const c of courses) {
    const slug = slugify(c.title);
    const course = await prisma.course.upsert({
      where: { slug },
      update: {},
      create: { title: c.title, slug, description: c.description, category: c.category },
    });
    for (let i = 0; i < c.lessons.length; i++) {
      await prisma.lesson.upsert({
        where: { courseId_order: { courseId: course.id, order: i + 1 } },
        update: {},
        create: {
          courseId: course.id,
          order: i + 1,
          title: c.lessons[i],
          durationMin: 8,
          contentMd: `# ${c.lessons[i]}\n\nThis lesson is part of **${c.title}**.\n\n## Key ideas\n\n- Evidence-based, practical guidance you can apply today.\n- Short exercises to embed the skill.\n\n## Practice\n\nTake three minutes now to reflect on how this topic shows up in your week, then write one sentence in your AKILI journal about it.`,
        },
      });
    }
  }
  console.log('  courses ✔');

  // ---- Knowledge base (RAG documents; embeddings are generated by the API worker) ----
  for (const doc of KNOWLEDGE_DOCS) {
    const existing = await prisma.knowledgeDocument.findFirst({ where: { title: doc.title } });
    if (!existing) {
      await prisma.knowledgeDocument.create({
        data: { title: doc.title, category: doc.category, source: 'internal', content: doc.content },
      });
    }
  }
  console.log('  knowledge documents ✔');

  // ---- Demo organization ----
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-kenya' },
    update: {},
    create: {
      name: 'Acme Kenya Ltd',
      slug: 'acme-kenya',
      industry: 'Technology',
      seats: 50,
      contactEmail: 'wellness@acme.co.ke',
    },
  });
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: demoUser.id } },
    update: {},
    create: { organizationId: org.id, userId: demoUser.id, isAdmin: true, status: 'ACTIVE', joinedAt: new Date() },
  });
  console.log('  organization ✔');

  // ---- Demo mood history (last 14 days) ----
  const existingMoods = await prisma.moodEntry.count({ where: { userId: demoUser.id } });
  if (existingMoods === 0) {
    const emotionSets = [
      ['calm', 'content'], ['stressed', 'tired'], ['happy', 'energetic'],
      ['anxious'], ['calm'], ['sad', 'tired'], ['happy', 'grateful'],
    ];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      await prisma.moodEntry.create({
        data: {
          userId: demoUser.id,
          score: 4 + Math.floor(Math.random() * 5),
          emotions: emotionSets[i % emotionSets.length],
          factors: i % 2 === 0 ? ['work'] : ['sleep', 'family'],
          createdAt: date,
        },
      });
    }
  }
  console.log('  demo mood history ✔');

  console.log(`Seed complete. Super admin: superadmin@akili.health / Akili@2026`);
  void superAdmin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
