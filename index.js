const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
app.use(cors())
// app.use(cors({
//     origin: ['https://b10a12-64e3d.web.app','http://localhost:5173'],
//     credentials: true // if you're using cookies or authentication headers
//   }));

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
const paymentCollection = client.db("microDb").collection("payments");
const submittedTaskCollection = client.db("microDb").collection("submittedTask");
const withRequestCollection = client.db("microDb").collection("withdrawRequest");

async function run() {
    try {
        const verifyToken = (req, res, next) => {
            // console.log('inside Verify Token coming from interceptor',req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'UnAuthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'UnAuthorized access' })
                }
                req.decoded = decoded;
                //   console.log(req.decoded)
                next();
            })
            // 
        }
        // use verifyAdmin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            if (!isAdmin)
                return res.status(403).send({ message: 'Forbidden access' })
            next()
        }
        const verifyBuyer = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isBuyer = user?.role === 'buyer'
            if (!isBuyer)
                return res.status(403).send({ message: 'Forbidden access' })
            next()
        }
        const verifyWorker = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isWorker = user?.role === 'worker'
            if (!isWorker)
                return res.status(403).send({ message: 'Forbidden access' })
            next()
        }
        // payment intent 
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']

            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })


        })
        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const value = payment.price * 10 // if payment.price are 2 then coin will be 20 , coin = dollar * 10
            const paymentResult = await paymentCollection.insertOne(payment)
            const email = req.query.email;
            const query = { email: email }

            const updatedDoc = {
                $inc: {
                    coin: +value
                }
            }
            const deleteResult = await userCollection.updateOne(query, updatedDoc)
            res.send({ paymentResult, deleteResult })
        })
        app.get('/purchaseInfo', async (req, res) => {
            const email = req.query.email;
            const filter = { email: email }
            const result = await paymentCollection.find(filter).toArray();
            res.send(result)
            // console.log(result)
        })
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET_KEY, { expiresIn: '1h' })
            res.send({ token })
        })
        // for admin 
        app.get('/user/admin/:email', async (req, res) => {
            const email = req.params.email;
            if (email != req.decoded.email) {
                res.status(403).send({ message: "Forbidden Access" })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role == 'admin'
            }
            res.send({ admin })
        })


        // for buyer 
        app.get('/user/buyer/:email', async (req, res) => {
            const email = req.params.email;
            if (email != req.decoded.email) {
                res.status(403).send({ message: "Forbidden Access" })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query);
            let buyer = false;
            if (user) {
                buyer = user?.role == 'buyer'
            }
            res.send({ buyer })
        })
        // ----
        // for worker 
        app.get('/user/worker/:email',
            async (req, res) => {
                const email = req.params.email;
                if (email != req.decoded.email) {
                    res.status(403).send({ message: "Forbidden Access" })
                }
                const query = { email: email }
                const user = await userCollection.findOne(query);
                let worker = false;
                if (user) {
                    worker = user?.role == 'worker'
                }
                res.send({ worker })
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
        app.get('/users', async (req, res) => {
            // console.log(req.headers)
            const email = req.query.email;
            const filter = { email: email }
            const result = await userCollection.findOne(filter);
            res.send(result);
        })
        app.get('/totalUser', async (req, res) => {

            const result = await userCollection.find().toArray();
            res.send(result);
        })
        app.get('/totalWorker', async (req, res) => {
            const filter = { role: 'worker' }
            const result = await userCollection.find(filter).toArray();
            res.send(result);
        })
        app.get('/totalBuyer', async (req, res) => {
            const filter = { role: 'buyer' }
            const result = await userCollection.find(filter).toArray();
            res.send(result);
        })
        app.get('/totalAmount', async (req, res) => {

            const result = await paymentCollection.find().toArray();
            res.send(result);
        })
        app.get('/totalRequest', async (req, res) => {

            const result = await withRequestCollection.find().toArray();
            res.send(result);
        })
        app.get('/totalRequest/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await withRequestCollection.findOne(filter)
            res.send(result);
        })

        app.patch('/updateApprove/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { status: 'approve' }
            }
            const result = await withRequestCollection.updateOne(
                query,
                updateDoc
            )
            res.send(result);

        })
        app.patch('/decreaseCoin', async (req, res) => {
            const info = req.body

            const query = { email: info?.worker_email }
            const updateDoc = {
                $inc: { coin: -info?.payable_amount }
            }
            const result = await userCollection.updateOne(
                query,
                updateDoc
            )
            console.log('update hoise worker ', result)
            res.send(result);

        })

        app.delete('/totalUser/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(filter)
            console.log('delete er result', result)
            res.send(result)
        })
        app.patch('/updateRole/:id', async (req, res) => {
            const info = req.body
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { role: info?.role }
            }
            const result = await userCollection.updateOne(
                query,
                updateDoc
            )
            res.send(result);

        })

        // //    task related api 
        app.get('/submittedTask', async (req, res) => {
            const email = req.query.email;
            const page = parseInt(req.query.page) - 1;
            const size = parseInt(req.query.size);

            const filter = {
                Buyer_email: email,
                status: 'pending'
            }
            const result = await submittedTaskCollection.find(filter).toArray();
            res.send(result)

        })
       
       

        // app.get('/mySubmission', async (req, res) => {
        //     const count = await productCollection.estimatedDocumentCount();
        //     res.send({ count })
        // })

        app.get('/submittedTask/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await submittedTaskCollection.findOne(filter)
            res.send(result)
        })
        app.patch('/submittedTask/:id',
            async (req, res) => {
                const statusType = req.body;
                console.log(statusType)
                const status = statusType.status
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const updateDoc = {
                    $set: { status: status }
                }
                const result = await submittedTaskCollection.updateOne(
                    query,
                    updateDoc
                )
                res.send(result);

            })


        app.patch('/updateWorker/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $inc: { required_workers: +1 }
            }
            const result = await taskCollection.updateOne(
                query,
                updateDoc
            )
            console.log('update hoise worker ', result)
            res.send(result);

        })

        // worker_email --> submitted db
        // email --> users db


        app.patch('/updateCoin', async (req, res) => {
            const info = req.body

            const query = { email: info?.worker_email }
            const updateDoc = {
                $inc: { coin: +info?.payable_amount }
            }
            const result = await userCollection.updateOne(
                query,
                updateDoc
            )
            console.log('update hoise worker ', result)
            res.send(result);

        })
        app.patch('/updateStatus/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { status: 'approve' }
            }
            const result = await submittedTaskCollection.updateOne(
                query,
                updateDoc
            )
            res.send(result);

        })
        app.post('/tasks', async (req, res) => {
            const taskInfo = req.body;
            const result = await taskCollection.insertOne(taskInfo)
            res.send(result)
        })
        app.patch('/tasks', async (req, res) => {
            const coinAmount = req.body;
            console.log(coinAmount)
            const coin = coinAmount.totalPayableAmount
            const email = req.query.email;
            const query = { email: email }

            const user = await userCollection.findOne(query);
            const updateDoc = {
                $inc: { coin: -coin }
            }
            const result = await userCollection.updateOne(
                query,
                updateDoc
            )
            res.send(result);

        })

        app.patch('/taskUpdate/:id', async (req, res) => {
            const taskItem = req.body;
            const id = req.params.id;
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: { task_title: taskItem?.task_title, task_detail: taskItem?.task_detail, submission_info: taskItem?.submission_info }
            }
            const result = await taskCollection.updateOne(query, updateDoc)
            res.send(result);
        })
        app.patch('/tasksIncrement', async (req, res) => {
            const info = req.body;
            const coin = info.totalPayableCoin
            const email = req.query.email;
            const query = { email: email };

            const updatedDoc = {
                $inc: { coin: +coin }
            }
            const result = await userCollection.updateOne(query, updatedDoc)
            res.send(result)

        })
        app.get('/tasks/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const singleTaskInfo = await taskCollection.findOne(filter);
            res.send(singleTaskInfo)
        })
        app.get('/tasks', async (req, res) => {
            const email = req.query.email;
            let query = {}
            if (email)
                query = { email: email }
            const result = await taskCollection.find(query).toArray()
            res.send(result);
        })
        app.delete('/tasks/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await taskCollection.deleteOne(filter)
            res.send(result)
        })
        app.get('/totalTask', async (req, res) => {

            const result = await taskCollection.find().toArray()
            res.send(result)
        })
        // for worker api 
        app.get('/tasksGreater', async (req, res) => {

            let query = { required_workers: { $gt: 0 } }
            const result = await taskCollection.find(query).toArray()

            // console.log(result)
            res.send(result);
        })
        app.get('/taskDetails/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await taskCollection.findOne(query)
            console.log(result)
            res.send(result)
        })

        app.post('/taskSubmitted', async (req, res) => {
            const submittedInfo = req.body;
            const result = await submittedTaskCollection.insertOne(submittedInfo)
            res.send(result)
        })
         // pagination 
        app.get('/submittedInfo', async (req, res) => {
            const email = req.query.email;
            const page = parseInt(req.query.page) - 1;
            const size = parseInt(req.query.size);
            console.log('pagination query', page, size);
            const query = { worker_email: email }
            // const total = await submittedTaskCollection.countDocuments(query);
            const result = await submittedTaskCollection.find(query).skip(page * size).limit(size).toArray()
            res.send(result);
        })
        app.get('/taskCount', async (req,res)=>{
            const email = req.query.email;
            const filter = {worker_email : email}
            
            const result  = await  submittedTaskCollection.find(filter).toArray();
            res.send(result)
          })
      
        app.get('/pendingInfo', async (req, res) => {
            const email = req.query.email;

            const query = { worker_email: email, status: 'pending' }
            const result = await submittedTaskCollection.find(query).toArray()
            res.send(result);
        })
        app.get('/approveInfo', async (req, res) => {
            const email = req.query.email;

            const query = { worker_email: email, status: 'approve' }
            const result = await submittedTaskCollection.find(query).toArray()
            res.send(result);
        })
        // withRequestCollection
        app.post('/withdrawRequest', async (req, res) => {
            const info = req.body;
            const result = await withRequestCollection.insertOne(info)
            res.send(result)
        })
        app.patch('/withdrawRequest', async (req, res) => {
            const info = req.body;
            const coin = info.coin;
            const email = req.query.email;
            const query = { email: email };

            const updatedDoc = {
                $inc: { coin: -coin }
            }
            const result = await userCollection.updateOne(query, updatedDoc)
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