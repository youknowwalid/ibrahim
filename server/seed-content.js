// Default site content. Everything here is editable from the admin panel (/admin).
// Only verified, real information about Anonna Fatima is used. Photos are the ones she supplied.
// Each factual statement below is backed by one of the sources listed in the "featured" items.

const img = (n) => `/uploads/anonna-${String(n).padStart(2, '0')}.webp`;
const thumb = (n) => `/uploads/anonna-${String(n).padStart(2, '0')}-thumb.webp`;

export const defaultContent = {
  site: {
    name: 'Anonna Fatima',
    logoText: 'Anonna Fatima',
    seoTitle: 'Anonna Fatima | Model, Anchor & Actress — Miss Grand Bangladesh 2026',
    seoDescription:
      'Official portfolio of Anonna Fatima — model, anchor and actress from Bangladesh and Miss Grand Bangladesh 2026. Photos, press features and booking enquiries.',
    shareImage: img(3),
    copyright: '© 2026 Anonna Fatima. All rights reserved.',
    footerRight: '',
    // Add real profile links in the admin panel (Site Settings → Social links). Icons only appear when a link is set.
    socials: [
      { type: 'instagram', url: '' },
      { type: 'facebook', url: '' },
      { type: 'twitter', url: '' },
      { type: 'youtube', url: '' },
      { type: 'tiktok', url: '' },
      { type: 'linkedin', url: '' },
    ],
    menu: [
      { label: 'Home', path: '/' },
      { label: 'About', path: '/about' },
      { label: 'Lookbook', path: '/lookbook' },
      { label: 'Contact', path: '/contact' },
    ],
  },

  home: {
    hero: {
      title: 'Anonna Fatima',
      image: img(6),
      focus: '50% 35%',
    },
    marquee: ['Model', 'Anchor', 'Actress', 'Miss Grand Bangladesh 2026', 'Fashion Design'],
    intro: {
      heading: 'Model, anchor and actress from Bangladesh',
      text:
        'Anonna Fatima is a model, anchor and actress with an academic background in fashion design. She has been involved in modelling since 2020.',
      imageLandscape: img(9),
      imageLandscapeFocus: '50% 40%',
      imagePortrait: img(4),
      imagePortraitFocus: '50% 20%',
      textRight:
        'In 2026 she was crowned Miss Grand Bangladesh and will represent Bangladesh at Miss Grand International 2026 in Thailand, following her appearance at Miss Intercontinental 2023 in Egypt.',
    },
    stats: {
      heading: 'At a Glance',
      items: [
        { value: '2020', label: 'Modelling since' },
        { value: '2023', label: 'Miss Intercontinental Bangladesh' },
        { value: '2026', label: 'Miss Grand Bangladesh' },
        { value: 'Honours', label: 'Degree in Fashion Design' },
      ],
    },
    portfolio: {
      heading: 'Portfolio',
      text:
        'A selection of photographs of Anonna — from pageant appearances to editorial and outdoor shoots.',
      items: [
        {
          id: 'p1',
          category: 'Pageant',
          title: 'Miss Grand Bangladesh',
          description: 'Representing Bangladesh at Miss Grand International 2026 in Thailand.',
          image: img(3),
          focus: '50% 25%',
          link: '/lookbook',
        },
        {
          id: 'p2',
          category: 'Pageant',
          title: 'Bangladesh Sash',
          description: 'A sequin gown look finished with the Bangladesh sash.',
          image: img(2),
          focus: '50% 25%',
          link: '/lookbook',
        },
        {
          id: 'p3',
          category: 'Editorial',
          title: 'Soft Pink',
          description: 'A quiet profile portrait with flowers in her hair.',
          image: img(8),
          focus: '50% 30%',
          link: '/lookbook',
        },
        {
          id: 'p4',
          category: 'Outdoor',
          title: 'Golden Fields',
          description: 'A shoot among golden flowers in open fields.',
          image: img(6),
          focus: '50% 40%',
          link: '/lookbook',
        },
        {
          id: 'p5',
          category: 'Style',
          title: 'White Ruched',
          description: 'A white ruched dress against a concrete wall.',
          image: img(5),
          focus: '50% 25%',
          link: '/lookbook',
        },
      ],
    },
    featured: {
      heading: 'Featured',
      text: 'News, interviews and listings that mention Anonna Fatima. Select a card to read more.',
      items: [
        {
          id: 'f1',
          visible: true,
          kind: 'image',
          title: 'Beyond the crown, a voice for change',
          publication: 'The Bangladesh Today',
          date: '2026-09-26',
          author: 'Shehub Munawar Wahid',
          type: 'Profile',
          mediaUrl: img(3),
          thumbnail: thumb(3),
          description:
            'A profile of Anonna Fatima as Miss Grand Bangladesh 2026. It describes her as a model, anchor and actress with a background in fashion design, traces her pageant path from Miss Universe to Miss Intercontinental 2023 in Egypt, and covers her "Stop the War and Violence" theme and her work with Project Shakti, an initiative for empowering girls and young people.',
          sourceLabel: 'Read on The Bangladesh Today',
          sourceUrl: 'https://thebangladeshtoday.com/?p=37718',
        },
        {
          id: 'f2',
          visible: true,
          kind: 'image',
          title: 'Anonna to represent Bangladesh in Egypt',
          publication: 'The Daily Messenger',
          date: '2023-11-07',
          author: '',
          type: 'News',
          mediaUrl: img(2),
          thumbnail: thumb(2),
          description:
            'News report on Anonna Fatima winning Miss Intercontinental Bangladesh and preparing to represent the country in Egypt, the event scheduled for 28 November to 15 December 2023 with more than 70 countries taking part. It notes she has modelled since 2020 and holds an honours degree in fashion design.',
          sourceLabel: 'Read on The Daily Messenger',
          sourceUrl: 'https://www.dailymessenger.net/entertainment/news/10143',
        },
        {
          id: 'f3',
          visible: true,
          kind: 'image',
          title: 'Miss Grand International 2026 — Contestants',
          publication: 'Miss Grand International',
          date: '',
          author: '',
          type: 'Official listing',
          mediaUrl: img(3),
          thumbnail: thumb(3),
          description:
            'Anonna Fatima is listed on the official Miss Grand International website as Bangladesh’s contestant for the 2026 edition, which is held in Thailand.',
          sourceLabel: 'Visit missgrandinternational.com',
          sourceUrl: 'https://missgrandinternational.com/contestants/',
        },
        {
          id: 'f4',
          visible: true,
          kind: 'image',
          title: 'Miss Grand Bangladesh — titleholders',
          publication: 'Wikipedia',
          date: '',
          author: '',
          type: 'Reference',
          mediaUrl: img(1),
          thumbnail: thumb(1),
          description:
            'Wikipedia’s page on the Miss Grand Bangladesh pageant lists Anonna Fatima as the reigning titleholder, crowned by outgoing titleholder Jessia Islam, and notes her earlier title of Miss Intercontinental Bangladesh 2023.',
          sourceLabel: 'Read on Wikipedia',
          sourceUrl: 'https://en.wikipedia.org/wiki/Miss_Grand_Bangladesh',
        },
      ],
    },
    cta: {
      text: 'For collaborations, bookings and media enquiries, please get in touch.',
      buttonLabel: 'Get In Touch',
      buttonLink: '/contact',
    },
  },

  about: {
    title: 'About Me',
    subtitle: 'Model, anchor and actress — Miss Grand Bangladesh 2026.',
    images: [img(4), img(8), img(10), img(9), img(5), img(1), img(7), img(11)],
    left: [
      'Anonna Fatima is a model, anchor and actress with an academic background in fashion design. She has been involved in modelling since 2020.',
      'Her pageant journey began with the Miss Universe pageant. In 2023 she won Miss Intercontinental Bangladesh, which took her to Egypt to compete at Miss Intercontinental 2023 as one of the Asian representatives.',
    ],
    right: [
      'In 2026 she was crowned Miss Grand Bangladesh and will represent Bangladesh at Miss Grand International 2026 in Thailand.',
      'Anonna speaks about empowering girls and young people through Project Shakti, and has adopted the theme “Stop the War and Violence” for her Miss Grand journey. Her stated ambition is to turn pageant visibility into advocacy while building a career that combines beauty, personal branding and business.',
    ],
    showStats: true,
  },

  lookbook: {
    sections: [
      { id: 'l1', category: 'Pageant', title: 'Bangladesh', images: [img(2), img(3), img(1)] },
      { id: 'l2', category: 'Editorial', title: 'Style', images: [img(4), img(5), img(8), img(11)] },
      { id: 'l3', category: 'Outdoor', title: 'Golden Light', images: [img(6), img(7), img(9), img(10)] },
    ],
  },

  contact: {
    title: 'Let’s Work Together',
    subtitle:
      'Tell me a bit about your project, timeline, and vision—I’ll get back to you as soon as possible.',
    image: img(10),
    focus: '50% 30%',
    timeSlots: ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','01:00 PM','01:30 PM','02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','04:30 PM','05:00 PM','05:30 PM','06:00 PM'],
    successMessage: 'Thank you! Your message has been sent. I’ll be in touch soon.',
    buttonLabel: 'SEND MESSAGE',
  },
};
