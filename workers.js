const workers = [
  {
    name: 'camel',
    proxy: 'https://scrapedown.camel-wides.workers.dev/?url=',
    delay: 0,
    agent: 'RokomariSearchIndexBot/1.0'
  },
  {
    name: 'sayuri',
    proxy: 'https://scrapedown.moyshik7.workers.dev/?url=',
    delay: 0,
    agent: 'SayuriSearchIndexBot/1.0'
  },
  {
    name: 'local',
    proxy: 'none',
    delay: 100,
    agent: 'CrackheadsSearchIndexBot/1.0'
  }
];

export default workers;