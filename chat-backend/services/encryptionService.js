// used for message encryption
require('dotenv').config();
const crypto=require('crypto');
const algorithm='aes-256-cbc';//using the algorith for encryption
const key=crypto.scryptSync(process.env.ENCRYPTION_SECRET, 'salt', 32)//key is provided in env file
if (!process.env.ENCRYPTION_SECRET) {
    throw new Error('ECNRYPTION_SECRET not defined')
}
function encrypt(text){
    const iv=crypto.randomBytes(16); //it generates a randome vector
    const cipher=crypto.createCipheriv(algorithm, key, iv); //creating cipher
    let encrypted=cipher.update(text, 'utf8' , 'hex');
    encrypted+=cipher.final('hex'); 
    return {
        iv: iv.toString('hex'),
        content: encrypted
    };
}

function decrypt({iv,content}){
    const decipher=crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex')); 
    let decrypted=decipher.update(content, 'hex', 'utf8');
    decrypted+=decipher.final('utf8');
    return decrypted;
}

module.exports={encrypt,decrypt};