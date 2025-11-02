export default function handler(req, res) {
  res.json({ key: process.env.KAKAO_API_KEY });
}
