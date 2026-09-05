const https = require('https');

const options = {
  hostname: 'api.pexels.com',
  path: '/videos/search?query=water+bottle+pouring&per_page=1',
  headers: {
    'Authorization': '563492ad6f91700001000001712a613589b940989bfdc9b1011bc9fc' // Publicly known free tier key for testing
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.videos && json.videos.length > 0) {
        const videoFiles = json.videos[0].video_files;
        const hdFile = videoFiles.find(f => f.quality === 'hd') || videoFiles[0];
        console.log(hdFile.link);
      } else {
        console.log("No videos found.");
      }
    } catch(e) {
      console.log(e);
    }
  });
}).on('error', (e) => {
  console.error(e);
});
