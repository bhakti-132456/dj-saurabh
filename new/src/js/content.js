// Facts from Saurabh's press kit and the previous site. Years after 2020 were not given,
// so those entries are labelled by role rather than by date.
export const timeline = [
    { when: '2013', where: '10 Lounge', what: 'First residency, Hyderabad', photo: 'booth-wide' },
    { when: '2014', where: 'Unique Bar-Beque', what: 'Hyderabad', photo: 'booth-front' },
    { when: '2015–16', where: 'Alankrita Resorts', what: 'Two seasons, Hyderabad', photo: 'pioneer' },
    { when: '2017', where: 'La La Land Shuddh Desi Bar', what: 'Hyderabad', photo: 'motion-blur' },
    { when: '2018–20', where: 'By The Bottle', what: 'Three-year residency, Hyderabad', photo: 'violet-room' },
    { when: 'Then', where: 'Xtreme Sports Bar · Tap Quench · Free Flow Traffic · Shake Stir Muddle', what: 'Residencies across Hyderabad', photo: 'red-beam' },
    { when: 'Then', where: 'Farzi Cafe', what: 'Resident DJ, Hyderabad', photo: 'deck-hands' },
    { when: 'Now', where: 'Tabula Rasa Alfresco Bar', what: 'Resident DJ, Hyderabad', now: true, photo: 'portrait-alt' },
];

export const venues = [
    { name: 'Tabula Rasa Alfresco Bar', city: 'Hyderabad' },
    { name: 'Farzi Cafe', city: 'Hyderabad' },
    { name: 'By The Bottle', city: 'Hyderabad' },
    { name: 'Aura Beach Club', city: 'Goa' },
    { name: 'Chizzale Night Club', city: 'Goa' },
    { name: 'Out Of The Box', city: 'Delhi' },
    { name: 'News Cafe', city: 'Bangalore' },
    { name: 'Club Rain', city: 'Hyderabad' },
    { name: '10 Lounge', city: 'Hyderabad' },
    { name: 'Xtreme Sports Bar', city: 'Hyderabad' },
    { name: 'Spoil Night Club', city: 'Hyderabad' },
    { name: 'Tap Quench Bar', city: 'Hyderabad' },
    { name: 'Free Flow Traffic Bar', city: 'Hyderabad' },
    { name: 'Lahari Resorts', city: 'Hyderabad' },
    { name: 'Alankrita Resorts', city: 'Hyderabad' },
];

// Ordered into poster tiers: top line, second line, the rest
export const lineup = [
    ['Blot!', 'Akbar Sami', 'Between Us', 'Midnight Traffic'],
    ['Ankytrixx', 'Vinayak^a', 'Animal Picnic', 'Angelov', 'DJ Piyush Bajaj', 'DJ Suketu', 'Swarup Varma', 'Avantika Bakshi'],
    ['DJ Kan-i', 'DJ Abhijit', 'DJ Rink', 'DJ Karma', 'DJ NYK', 'DJ Harsh Mahant', 'Murothovic', 'DJ Tejas', 'DJ Lemon', 'DJ Kawal'],
];

export const gallery = [
    { src: 'portrait-alt', shape: 'tall', alt: 'Saurabh at the decks, looking into the camera' },
    { src: 'red-beam', shape: 'tall', alt: 'Red beam across the booth while he mixes' },
    { src: 'booth-wide', shape: 'wide', alt: 'Wide shot of Saurabh behind a Pioneer setup' },
    { src: 'motion-blur', shape: 'wide', alt: 'Long exposure of the decks in motion' },
    { src: 'wedding-sangeet', shape: 'tall', alt: 'Saurabh performing at a sangeet under festoon lights' },
    { src: 'deck-hands', shape: 'tall', alt: 'Saurabh working the mixer at a lounge' },
    { src: 'pioneer', shape: 'wide', alt: 'Saurabh behind the Pioneer DJ booth' },
    { src: 'violet-room', shape: 'wide', alt: 'Violet light over the booth during a set' },
    { src: 'booth-front', shape: 'wide', alt: 'Front view of Saurabh at the controller' },
];

export const decks = {
    A: { title: 'Deep House Mix, part I', src: '/audio/deck-a.mp3' },
    B: { title: 'Deep House Mix, part II', src: '/audio/deck-b.mp3' },
};
