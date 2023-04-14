import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import joi from 'joi'

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

const hora = ()=>{
    if(`${dayjs().hour()}`.length<2){
        return `0${dayjs().hour()}`
    } else{
        return `${dayjs().hour()}`
    }
}

const minuto = ()=>{
    if(`${dayjs().minute()}`.length<2){
        return `0${dayjs().minute()}`
    } else{
        return `${dayjs().minute()}`
    }
}

const segundo = ()=>{
    if(`${dayjs().second()}`.length<2){
        return `0${dayjs().second()}`
    } else{
        return `${dayjs().second()}`
    }
}

const time = `${hora()}:${minuto()}:${segundo()}`

const nameSchema = joi.object({
    name: joi.string().required().min(3)
})

app.post('/participants', async (req, res)=>{

    const {name} = req.body

    const validation = nameSchema.validate({name})

    if (validation.error) return res.status(422).send('Nome inválido')

    try{
        const verifica = await db.collection('participants').findOne({name})
            if(verifica) return res.status(409).send("Usuário já existe")

        const novoParticipante = {name, lastStatus: Date.now()}
        const entrou = { 
            from: name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: time
        }

        await db.collection('participants').insertOne(novoParticipante)
        await db.collection('messages').insertOne(entrou)

        return res.sendStatus(201) 

    } catch(err){
        return res.status(500).send(err.message)
    }
})

app.get("/participants", (req, res) => {
    db.collection('participants').find().toArray()
        .then((participantes) => res.status(200).send(participantes))
        .catch((err) => res.status(500).send(err.message))
})

app.post('/messages', (req, res)=>{
    const {to, text, type} = req.body

    const { User } = req.headers

    const msg = {
        from: User,
        to,
        text,
        type,
        time: time
    }

    let ok = false

    db.collection('participants').findOne(User)
        .then(()=>{
            ok = true
            res.sendStatus()
        })
        .catch((err) => res.status(422).send(err.message))

    if(ok){
        db.collection('messages').insertOne(msg)
            .then(()=>res.sendStatus(201))
            .catch((err) => res.status(500).send(err.message))
    }

})

app.get('/messages', (req, res)=>{

    const {User} = req.headers

    db.collection('messages').find({$or: [
        {type: 'message'}, 
        {to: 'Todos'}, 
        {to: User}, 
        {from: User}
    ]}).toArray()
        .then((mensagens) => res.status(200).send(mensagens))
        .catch((err) => res.status(500).send(err.message))
})

// Deixa o app escutando, à espera de requisições
const PORT = 5000
app.listen(PORT, ()=>console.log(`O servidor está rodando na porta ${PORT}`))
