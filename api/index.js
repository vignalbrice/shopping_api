const http = require("http");
const express = require("express");
const socket = require("socket.io");
const cors = require("cors");
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectId;
const { readFileSync } = require("fs");
require("dotenv").config();
const port = process.env.PORT || 4000;

const uri =
  "mongodb+srv://bvignal:admin@cluster0.kqxcw.mongodb.net/shopping?retryWrites=true&w=majority";
const app = express();
const server = http.createServer(app);
app.use(cors());
const io = socket(server, {
  cors: {
    origin: "http://0.0.0.0:8080",
  },
});

app.get("/", (req, res) => {
  res.send("<h1>Hello world</h1>");
});
let changeStream;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
client.connect((err) => {
  if (err) throw err;
  const db = client.db("shopping");
  const products = db.collection("products");
  const categories = db.collection("categories");
  io.on("connection", async (socket) => {
    changeStream = products.watch();
    // set up a listener when change events are emitted
    changeStream.on("change", (next) => {
      // process any change event
      if (next) {
        products
          .find({})
          .toArray()
          .then((data) => {
            socket.emit("products", data);
          });
      }
    });
    // get products list
    socket.on("products", async () => {
      const data = await products.find({}).toArray();
      socket.emit("data", data);
    });
    // get categories list
    socket.on("categories", async () => {
      const data = await categories.find({}).toArray();
      socket.emit("categoriesList", data);
    });
    // get a single product by ID
    socket.on("product", async (id) => {
      const product = await products.findOne({ _id: ObjectId(id) });
      socket.emit("productById", product);
    });
    // delete a single product by ID
    socket.on("delete", async (id) => {
      const result = await products.deleteOne({ _id: ObjectId(id) });
      socket.emit("deletedProduct", result.deletedCount);
    });
    // insert a single product
    socket.on("insertProduct", async (product) => {
      const result = await products.insertOne(product);
      socket.emit("insertedProduct", result.insertedId);
    });
    // update a single product
    socket.on("updateProduct", async (data) => {
      const id = ObjectId(data._id);
      delete data._id;
      const result = await products.updateMany(
        { _id: id },
        { $set: data },
        { upsert: true }
      );
      if (result) {
        const product = await products.findOne({ _id: ObjectId(id) });
        socket.emit("updatedProduct", product);
      }
    });
  });

  app.get("/products", async (req, res) => {
    const data = await products.find({}).toArray();
    res.send(data);
  });
  app.get("/categories", async (req, res) => {
    const data = await categories.find({}).toArray();
    res.send(data);
  });
  app.get("/product/:id", async (req, res) => {
    const id = ObjectId(req.params.id);
    const query = { _id: id };
    const product = await products.findOne(query);
    res.send(product);
  });
  app.get("/categories/:id", async (req, res) => {
    const id = ObjectId(req.params.id);
    const query = { _id: id };
    const category = await categories.findOne(query);
    res.send(category);
  });
});

server.listen(port, () => {
  console.log("listening on *:4000");
});

app.use(express.static("public"));

module.exports = app;
