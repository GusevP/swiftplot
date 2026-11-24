export const disk = [
  {
    name: 'Photos',
    children: [
      {
        name: '2024',
        children: [
          { name: 'Holidays', value: 38 },
          { name: 'Family', value: 22 },
        ],
      },
      {
        name: '2025',
        children: [
          { name: 'Holidays', value: 45 },
          { name: 'Family', value: 18 },
          { name: 'Pets', value: 9 },
        ],
      },
      {
        name: '2026',
        children: [
          { name: 'Family', value: 26 },
          { name: 'Screenshots', value: 6 },
        ],
      },
    ],
  },
  {
    name: 'Projects',
    children: [
      {
        name: 'Website',
        children: [
          { name: 'Source', value: 4 },
          { name: 'Builds', value: 12 },
        ],
      },
      {
        name: 'Game',
        children: [
          { name: 'Assets', value: 34 },
          { name: 'Source', value: 7 },
        ],
      },
      { name: 'Notes', value: 2 },
    ],
  },
  {
    name: 'Music',
    children: [
      { name: 'Albums', value: 28 },
      { name: 'Podcasts', value: 11 },
      {
        name: 'Recordings',
        children: [
          { name: 'Demos', value: 8 },
          { name: 'Takes', value: 5 },
        ],
      },
    ],
  },
  {
    name: 'Apps',
    children: [
      { name: 'Editors', value: 9 },
      { name: 'Games', value: 31 },
      { name: 'Tools', value: 6 },
    ],
  },
] as const;
