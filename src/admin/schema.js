import { uid } from './api.js';

// Describes every editable part of the website. The admin panel builds its forms from this list,
// so adding a field here is all that is needed to make something editable.
const text = (path, label, o = {}) => ({ type: 'text', path, label, ...o });
const area = (path, label, o = {}) => ({ type: 'textarea', path, label, ...o });
const image = (path, label, o = {}) => ({ type: 'image', path, label, ...o });

const socialNames = { instagram: 'Instagram', facebook: 'Facebook', twitter: 'X (Twitter)', youtube: 'YouTube', tiktok: 'TikTok', linkedin: 'LinkedIn' };

export const SECTIONS = [
  {
    id: 'site', label: 'Site & Menu', group: 'Whole website',
    intro: 'Your name, the browser/Google title, footer text, social media links and the menu.',
    fields: [
      text('site.name', 'Your name', { help: 'Used in page titles and image descriptions.' }),
      text('site.logoText', 'Logo text (top left)', { help: 'Shown at the top left of every page.' }),
      text('site.seoTitle', 'Home page title (Google & browser tab)'),
      area('site.seoDescription', 'Home page description (Google)', { rows: 3, help: 'One or two sentences shown in search results.' }),
      image('site.shareImage', 'Preview image when the site is shared', { help: 'Shown when the link is shared on WhatsApp, Facebook, etc.' }),
      text('site.copyright', 'Footer text (left)'),
      text('site.footerRight', 'Footer text (right)', { help: 'Optional — leave empty to hide.' }),
      {
        type: 'list', path: 'site.socials', label: 'Social media links', fixed: true, itemTitle: (i) => socialNames[i.type] || i.type,
        help: 'Paste the full address of each profile. An icon only appears on the website when a link is filled in.',
        fields: [{ type: 'text', key: 'url', label: 'Profile link', placeholder: 'https://www.instagram.com/…' }],
      },
      {
        type: 'list', path: 'site.menu', label: 'Menu links', addLabel: 'menu link', itemTitle: 'label', max: 8,
        help: 'The pages shown in the slide-out menu. Use /about, /lookbook, /contact, or a full web address.',
        newItem: () => ({ label: 'New page', path: '/' }),
        fields: [{ type: 'text', key: 'label', label: 'Label' }, { type: 'text', key: 'path', label: 'Link' }],
      },
    ],
  },
  {
    id: 'hero', label: 'Home · Hero & Banner', group: 'Home page',
    intro: 'The big opening picture with your name, and the scrolling banner underneath it.',
    fields: [
      text('home.hero.title', 'Big name on the opening picture'),
      image('home.hero.image', 'Opening picture', { focusPath: 'home.hero.focus', help: 'A wide (landscape) picture works best. Click the preview to choose which part stays visible.' }),
      { type: 'strings', path: 'home.marquee', label: 'Scrolling banner words', help: 'Each line becomes one item in the scrolling band.', addLabel: 'Add banner item' },
    ],
  },
  {
    id: 'intro', label: 'Home · Introduction', group: 'Home page',
    intro: 'The pink section with the two pictures and short introduction.',
    fields: [
      text('home.intro.heading', 'Heading'),
      area('home.intro.text', 'Paragraph (left, under the heading)', { rows: 4 }),
      image('home.intro.imageLandscape', 'Wide picture (left)', { focusPath: 'home.intro.imageLandscapeFocus' }),
      image('home.intro.imagePortrait', 'Tall picture (right)', { focusPath: 'home.intro.imagePortraitFocus' }),
      area('home.intro.textRight', 'Paragraph (right, under the tall picture)', { rows: 4 }),
    ],
  },
  {
    id: 'stats', label: 'Home · Stats cards', group: 'Home page',
    intro: 'The row of small cards (“At a Glance”). Numbers count up when the visitor scrolls to them. You can add measurements such as Height or Dress size here if you wish to show them.',
    fields: [
      text('home.stats.heading', 'Section heading'),
      {
        type: 'list', path: 'home.stats.items', label: 'Cards', addLabel: 'stats card', itemTitle: (i) => `${i.value || ''} — ${i.label || ''}`, max: 6,
        newItem: () => ({ value: '', label: '' }),
        fields: [
          { type: 'text', key: 'value', label: 'Big text', help: 'Numbers roll up automatically, e.g. 175 cm or 2026.' },
          { type: 'text', key: 'label', label: 'Small label' },
        ],
      },
    ],
  },
  {
    id: 'portfolio', label: 'Home · Portfolio', group: 'Home page',
    intro: 'The row of tall pictures that expand when hovered.',
    fields: [
      text('home.portfolio.heading', 'Section heading'),
      area('home.portfolio.text', 'Intro text', { rows: 3 }),
      {
        type: 'list', path: 'home.portfolio.items', label: 'Portfolio cards', addLabel: 'portfolio card', itemTitle: 'title', thumbKey: 'image', max: 8,
        help: 'Between 3 and 6 cards looks best.',
        newItem: () => ({ id: uid(), visible: true, category: '', title: 'New card', description: '', image: '', focus: '50% 30%', link: '/lookbook' }),
        fields: [
          { type: 'toggle', key: 'visible', label: 'Show on website' },
          { type: 'text', key: 'category', label: 'Small category line' },
          { type: 'text', key: 'title', label: 'Title' },
          { type: 'textarea', key: 'description', label: 'Short description', rows: 2 },
          { type: 'image', key: 'image', label: 'Picture', focusKey: 'focus' },
          { type: 'text', key: 'link', label: 'Opens page', help: 'For example /lookbook. Leave empty for no link.' },
        ],
      },
    ],
  },
  {
    id: 'featured', label: 'Home · Featured', group: 'Home page',
    intro: 'News, interviews and appearances. Visitors see small picture cards; clicking one opens a window with the full picture or video and your description underneath.',
    fields: [
      text('home.featured.heading', 'Section heading'),
      area('home.featured.text', 'Intro text', { rows: 2 }),
      {
        type: 'list', path: 'home.featured.items', label: 'Featured items', addLabel: 'featured item', itemTitle: 'title', thumbKey: 'thumbnail', max: 40,
        help: 'Add each real article, interview, video or photo here. Untick “Show on website” to hide an item without deleting it.',
        newItem: () => ({ id: uid(), visible: true, kind: 'image', title: 'New featured item', publication: '', date: '', author: '', type: 'Article', mediaUrl: '', thumbnail: '', description: '', sourceLabel: 'Read the full story', sourceUrl: '' }),
        fields: [
          { type: 'toggle', key: 'visible', label: 'Show on website' },
          { type: 'select', key: 'kind', label: 'Opens as', options: [['image', 'Picture'], ['video', 'Video']] },
          { type: 'text', key: 'title', label: 'Title / headline' },
          { type: 'media', key: 'mediaUrl', label: 'Picture or video', help: 'Choose or upload a picture or video, or paste a YouTube / Vimeo / direct video link.' },
          { type: 'image', key: 'thumbnail', label: 'Card thumbnail', help: 'The small picture visitors see on the website. Required for uploaded videos.' },
          { type: 'textarea', key: 'description', label: 'Description (shown under the picture or video)', rows: 5 },
          { type: 'text', key: 'publication', label: 'Publication / source name', placeholder: 'e.g. The Daily Star' },
          { type: 'text', key: 'type', label: 'Kind of feature', placeholder: 'Interview, News, Magazine…' },
          { type: 'text', key: 'author', label: 'Author (optional)' },
          { type: 'date', key: 'date', label: 'Date' },
          { type: 'text', key: 'sourceUrl', label: 'Link to the original article / source', placeholder: 'https://…' },
          { type: 'text', key: 'sourceLabel', label: 'Button text for that link' },
        ],
      },
    ],
  },
  {
    id: 'cta', label: 'Home · Contact banner', group: 'Home page',
    intro: 'The pink statement and button near the bottom of the Home and About pages.',
    fields: [
      area('home.cta.text', 'Statement', { rows: 3 }),
      text('home.cta.buttonLabel', 'Button text'),
      text('home.cta.buttonLink', 'Button opens', { help: 'For example /contact' }),
    ],
  },
  {
    id: 'about', label: 'About page', group: 'Other pages',
    intro: 'Your story and the photo strip at the top of the About page.',
    fields: [
      text('about.title', 'Page title'),
      text('about.subtitle', 'Subtitle'),
      { type: 'images', path: 'about.images', label: 'Photo strip', help: 'Visitors can drag or swipe through these.' },
      { type: 'strings', path: 'about.left', label: 'Story — left column', multiline: true, addLabel: 'Add paragraph' },
      { type: 'strings', path: 'about.right', label: 'Story — right column', multiline: true, addLabel: 'Add paragraph' },
      { type: 'toggle', path: 'about.showStats', label: 'Show the stats cards on this page' },
    ],
  },
  {
    id: 'lookbook', label: 'Lookbook page', group: 'Other pages',
    intro: 'Rows of photographs. Each row has a small category line, a title and as many pictures as you like.',
    fields: [
      {
        type: 'list', path: 'lookbook.sections', label: 'Lookbook rows', addLabel: 'row', itemTitle: 'title', thumbKey: 'images.0',
        newItem: () => ({ id: uid(), category: '', title: 'New row', images: [] }),
        fields: [
          { type: 'text', key: 'category', label: 'Small category line' },
          { type: 'text', key: 'title', label: 'Title' },
          { type: 'images', key: 'images', label: 'Pictures' },
        ],
      },
    ],
  },
  {
    id: 'contact', label: 'Contact page', group: 'Other pages',
    intro: 'The “Let’s Work Together” page. Messages sent through the form arrive in the Messages inbox.',
    fields: [
      text('contact.title', 'Page title'),
      area('contact.subtitle', 'Subtitle', { rows: 2 }),
      image('contact.image', 'Picture next to the form', { focusPath: 'contact.focus' }),
      text('contact.buttonLabel', 'Send button text'),
      area('contact.successMessage', 'Message shown after sending', { rows: 2 }),
      { type: 'strings', path: 'contact.timeSlots', label: 'Meeting time choices', addLabel: 'Add time' },
    ],
  },
];
