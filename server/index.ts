import express from "express";

const app = express();
const PORT = process.env.PORT!;
const HOST = process.env.HOST!;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

import document from "./routes/document";
app.use(document);

app.listen(parseInt(PORT), HOST, () => {
  console.log(`Listening on port ${PORT}...`);
});
