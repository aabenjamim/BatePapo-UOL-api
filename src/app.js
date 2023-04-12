import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import dayjs from 'dayjs'

// Criação do servidor
const app = express()

// Configurações
app.use(cors())
app.use(express.json())
dotenv.config()

// Conexão com o Banco de Dados
let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

// Endpoints
app.post('/participants', (req, res)=>{
    const {name} = req.body

    if(!name){
        return res.sendStatus(422)
    }

    const novoParticipante = {name, lastStatus: Date.now()}
    db.collection('participants').insertOne(novoParticipante)

    const entrou = { 
        from: name, 
        to: 'Todos', 
        text: 'entra na sala...', 
        type: 'status', 
        time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`
    }
    
    db.collection('messages').insertOne(entrou)
        .then(() => res.sendStatus(201))
        .catch((err) => res.status(500).send(err.message))
})

// Deixa o app escutando, à espera de requisições
const PORT = 5000
app.listen(PORT, ()=>console.log(`O servidor está rodando na porta ${PORT}`))
