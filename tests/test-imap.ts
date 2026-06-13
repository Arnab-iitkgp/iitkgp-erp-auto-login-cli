import { ImapFlow } from "imapflow";

const client = new ImapFlow({
    host: "imap.gmail.com",
    port:993,
    secure:true,
    auth:{
        user:"Mail id",
        pass:"app pswd"
    },
    logger:false,
});

try {
    console.log("Connecting...");
    await client.connect();
    console.log("connected\n");

    const lock = await client.getMailboxLock("INBOX");

    // const mailboxes  = await client.list();
    // console.log("Mailboxes: ");
    // for(const mb of mailboxes){
    //     console.log(` ${mb.path}`);
    // }

    try{
        const messages= await client.search({
            subject: "OTP for Sign In in ERP Portal of IIT Kharagpur",
        });
        if(messages){
            console.log(`fuond ${messages.length} otp emails`)
            console.log("UIDs: ",messages.slice(-5) )// last 5 uids

            if(messages.length>0){
                const latestUid = messages[messages.length-1];
                const msg = await client.fetchOne(String(latestUid),{
                    source:true,
                })

                //print raw first 1k chars
                if(msg && msg.source){
                    const raw = msg.source.toString();
                    // Skip headers 
                    const bodyStart = raw.indexOf("\r\n\r\n");
                    const body = bodyStart > -1 ? raw.substring(bodyStart + 4) : raw;

                    console.log("\nEmail body:");
                    console.log(body.substring(0, 500));

                    //  find the OTP directly
                    const otpMatch = raw.match(/\b(\d{6})\b/);
                    console.log("\nExtracted OTP:", otpMatch ? otpMatch[1] : "not found");

                }
                
            }
        }

    }finally{
        lock.release();
    }

    await client.logout();
    console.log("disconnected.")
} catch (err) {
    console.error("Failed :(", err);
}

export{}