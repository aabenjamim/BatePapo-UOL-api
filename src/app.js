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
    name: joi.string().required()
})

const messageSchema = joi.object({
    from: joi.required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid('message', 'private_message')
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

app.post('/messages', async (req, res)=>{
    const {to, text, type} = req.body

    const {user} = req.headers

    const msg = {
        from: user,
        to,
        text,
        type,
        time: time
    }

    const validation = messageSchema.validate({from: user, to, text, type}, { abortEarly: false })
        if (validation.error) return res.status(422).send(validation.error)

    try{
        const cadastrado = await db.collection('participants').findOne({name: user})
            if(!cadastrado) return res.status(422).send('O usuário não está logado')

        await db.collection('messages').insertOne(msg)
        res.sendStatus(201)
    } catch(err){
        return res.status(500).send(err.message)
    }
})

app.get('/messages', async (req, res)=>{

    const {user} = req.headers
    const limit = req.query.limit

    try{
        const mensagens = await db.collection('messages').find({$or: [
            {type: 'message'}, 
            {to: 'Todos'}, 
            {to: user}, 
            {from: user}
        ]}).toArray()

        if(limit){        
            if((limit<=0) || (isNaN(limit))){ 
                return res.status(422).send('limit está errado')
            } else{
                return res.status(200).send(mensagens.slice(-limit))
            }
        }

        return res.status(200).send(mensagens)

    }catch(err){
        return res.status(500).send(err.message)
    }
})

app.post('/status', async (req, res)=>{
    const {user} = req.headers

    try{
        const usuario = await db.collection('participants').findOne({name: user})
            if(!usuario) return res.sendStatus(404)
        
        await db.collection("participants").updateOne({name: user}, {$set: {lastStatus: Date.now()}});
        res.sendStatus(200)

    } catch(err){
        res.status(500).send(err.message)
    }
}) 


setInterval(async ()=>{

    const inativos = Date.now() - 10000

    try{
       const usuariosInativos =  await db.collection('participants').find({lastStatus: {$lte: inativos}}).toArray()
        if(usuariosInativos){
            usuariosInativos.map((user)=>{
            const mensagemSaida = {
                from: user.name, 
                to: 'Todos', 
                text: 'sai da sala...', 
                type: 'status', 
                time: time
            }

            db.collection('messages').insertOne(mensagemSaida)
        })
        }

        await db.collection('participants').deleteMany({lastStatus: {$lte: inativos}})

    } catch(err){
        return res.status(500).send(err.message)
    }

}, 15000)


// Deixa o app escutando, à espera de requisições
const PORT = 5000
app.listen(PORT, ()=>console.log(`O servidor está rodando na porta ${PORT}`))
