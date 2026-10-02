module.exports = function handler(req, res) {
  res.status(200).json({ ok: true, service: 'house-chat', version: '0.1.0', architecture: 'microfrontend' });
};
