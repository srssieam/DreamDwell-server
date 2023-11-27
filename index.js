const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xjpiwvy.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const reviewsCollection = client.db("dream-dwell").collection("reviews");
    const usersCollection = client.db("dream-dwell").collection("users");
    const propertyCollection = client.db("dream-dwell").collection("properties");

    // reviews related api
    app.get('/v1/api/reviews', async(req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    })

    app.delete('/v1/api/reviews/:id', async(req, res) => {
      const id = req.params.id ;
      const query = { _id: new ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
      res.send(result);
    })

    // user related api
    app.post('/v1/api/users', async(req, res) => {
      const user = req.body;
  
      // don't insert userInfo if user already exists
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query); // find user with the existing email
      if(existingUser){
        return res.send({ message: 'user already exists', insertedId: null });
      }

      // insert userInfo if user doesn't exist
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.get('/v1/api/users', async(req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.delete('/v1/api/users/:id', async(req, res) => {
      const id = req.params.id;
      console.log(id);
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    })

    // update user to admin
    app.patch('/v1/api/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    // update user to agent
    app.patch('/v1/api/users/agent/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'agent'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    // mark as fraud
    app.patch('/v1/api/users/fraud/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'fraud'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    // property related api
    app.get('/v1/api/properties', async (req, res) => {
      const result = await propertyCollection.find().toArray();
      res.send(result)
    })

    app.delete('v1/api/properties/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.deleteOne(query);
      res.send(result)
    })

    app.patch('/v1/api/properties/verify/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          verification_status: "verified"
        }
      }
      const result = await propertyCollection.updateOne(filter,  updatedDoc)
      res.send(result);
    })

    app.patch('/v1/api/properties/reject/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          verification_status: "rejected"
        }
      }
      const result = await propertyCollection.updateOne(filter,  updatedDoc)
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Dream Dwell server is running')
})

app.listen(PORT, ()=> {
    console.log(`DreamDwell server is running on http://localhost:${PORT}`)
})