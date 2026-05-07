const express = require('express');
const path = require('path');

const app = express();
const PORT = 8080;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index', {
    pageTitle: 'Introduction',
    activePage: 'home',
  });
});

app.get('/about', (req, res) => {
  res.render('about', {
    pageTitle: 'About',
    activePage: 'about',
  });
});

app.get('/game', (req, res) => {
  res.render('game', {
    pageTitle: 'Puzzle Game',
    activePage: 'game',
  });
});

app.get('/report.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'report.html'));
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
