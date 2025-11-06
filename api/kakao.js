module.exports = (req, res) => {
  res.status(200).json({ key: process.env.KAKAO_API_KEY });
};
