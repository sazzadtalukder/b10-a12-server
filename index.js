const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config()

app.use(cors())
app.use(express.json())

const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rsgeo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const userCollection = client.db("microDb").collection("users");
const taskCollection = client.db("microDb").collection("tasks");

async function run() {
    try {
        const verifyToken = (req,res,next)=>{
            // console.log('inside Verify Token coming from interceptor',req.headers.authorization)
            if(!req.headers.authorization){
                return res.status(401).send({message: 'UnAuthorized access'})
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token,process.env.JWT_SECRET_KEY, (err,decoded)=>{
                  if(err){
                    return res.status(401).send({message: 'UnAuthorized access'})
                  } 
                  req.decoded = decoded;
                //   console.log(req.decoded)
                  next();
            } )
            // 
        }
        // use verifyAdmin after verifyToken
        const verifyAdmin = async(req,res,next)=>{
            const email = req.decoded.email;
            const query = {email: email}
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if(!isAdmin)
                return res.status(403).send({message: 'Forbidden access'})
            next()
        }
        const verifyBuyer = async(req,res,next)=>{
            const email = req.decoded.email;
            const query = {email: email}
            const user = await userCollection.findOne(query)
            const isBuyer = user?.role === 'buyer'
            if(!isBuyer)
                return res.status(403).send({message: 'Forbidden access'})
            next()
        }
        const verifyWorker = async(req,res,next)=>{
            const email = req.decoded.email;
            const query = {email: email}
            const user = await userCollection.findOne(query)
            const isWorker = user?.role === 'worker'
            if(!isWorker)
                return res.status(403).send({message: 'Forbidden access'})
            next()
        }
        app.post('/jwt', async(req,res)=>{
            const user = req.body;
            const token = jwt.sign(user,process.env.JWT_SECRET_KEY,{expiresIn: '1h'})
            res.send({token})
        })
        // for admin 
        app.get('/user/admin/:email',verifyToken,async(req,res)=>{
            const email = req.params.email;
            if(email!= req.decoded.email){
                res.status(403).send({message: "Forbidden Access"})
            }
            const query= {email: email}
            const user = await userCollection.findOne(query);
            let admin = false;
            if(user){
                admin = user?.role == 'admin'
            }
            res.send({admin})
        })
        // for buyer 
        app.get('/user/buyer/:email',verifyToken,async(req,res)=>{
            const email = req.params.email;
            if(email!= req.decoded.email){
                res.status(403).send({message: "Forbidden Access"})
            }
            const query= {email: email}
            const user = await userCollection.findOne(query);
            let buyer = false;
            if(user){
                buyer = user?.role == 'buyer'
            }
            res.send({buyer})
        })
        // ----
         // for worker 
         app.get('/user/worker/:email',verifyToken,async(req,res)=>{
            const email = req.params.email;
            if(email!= req.decoded.email){
                res.status(403).send({message: "Forbidden Access"})
            }
            const query= {email: email}
            const user = await userCollection.findOne(query);
            let worker = false;
            if(user){
                worker = user?.role == 'worker'
            }
            res.send({worker})
        })
        // ----
        app.post('/users', async (req, res) => {
            
            const userInfo = req.body;
            const query = { email: userInfo.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            const result = await userCollection.insertOne(userInfo)
            res.send(result)
        })
        app.get('/users',verifyToken, async(req,res)=>{
            // console.log(req.headers)
            const email = req.query.email;
            const filter = { email: email}
            const result = await userCollection.findOne(filter);
            res.send(result);
        })
    //    task related api 
        app.post('/tasks',verifyToken,async(req,res)=>{
            const taskInfo = req.body;
            const result = await taskCollection.insertOne(taskInfo)
            res.send(result)
        })
        app.patch('/tasks',verifyToken,async(req,res)=>{
            const coinAmount = req.body;
            console.log(coinAmount)
            const coin  = coinAmount.totalPayableAmount
            const email = req.query.email;
            const query ={email: email}
            
            const user = await userCollection.findOne(query);
            const updateDoc = {
                $inc : {coin: -coin}
            }
            const result = await userCollection.updateOne(
                query,
                updateDoc
            )
            res.send(result);
            
        })
        app.patch('/tasksIncrement', async(req,res)=>{
            const info = req.body;
            const coin = info.totalPayableCoin
            const email = req.query.email;
            const query = {email: email};
            
            const updatedDoc = {
                $inc : {coin: +coin}
            }
            const result = await userCollection.updateOne(query,updatedDoc)
            res.send(result)

        })
        app.get('/tasks/:id',verifyToken,async(req,res)=>{
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)};
            const singleTaskInfo = await taskCollection.findOne(filter);
            res.send(singleTaskInfo)
        })
        app.get('/tasks', verifyToken,async(req,res)=>{
            const email = req.query.email;
            let query = {}
            if(email)
                query = {email: email}
            const result = await taskCollection.find(query).toArray()
            res.send(result);
        })
        app.delete('/tasks/:id', verifyToken,async(req,res)=>{
            const id = req.params.id;
            const filter = {_id : new ObjectId(id)}
            const result = await taskCollection.deleteOne(filter)
            res.send(result)
        })
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Assignment Server is running')
})
app.listen(port, () => {
    console.log(`Server is running at port -> ${port}`)
})