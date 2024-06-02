import app from "./app/app.js";
import connectDB from "./app/config/db.js";
import { port } from "./important.js";

app.listen(port, async () => {
  console.log(`backend app listening on port ${port}`);
  await connectDB();
});
