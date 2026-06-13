import { ErpSession } from "./session.js";

export class ErpClient{
    private session : ErpSession;
    private baseUrl:string;
    
    constructor(baseUrl:string){
        this.session = new ErpSession();
        this.baseUrl= baseUrl;
    }

    //every req goes thru this, 
    //-- attaches stored cookies, capture new cookies from the response
    //-- does not follow redirect (manual handling)

    private async request(
        url:string,
        options:RequestInit ={}
    ):Promise<Response>{
        const cookieHeader  = this.session.getCookieHeader();

        const headers : Record<string,string> ={
            ...(options.headers as Record<string,string>),
        };
        if (cookieHeader){
            headers["Cookie"] = cookieHeader;
        }

        const response = await fetch(url, {
            ...options,
            headers,
            redirect:"manual",
        });

        this.session.setCookiesFromResponse(response);
        return response;
    }

    async initiateSession(): Promise<{sessionToken: string, requestedUrl:string}>{

        let currentUrl = `${this.baseUrl}/IIT_ERP3/`;
        let entryUrl = `${this.baseUrl}/IIT_ERP3/`;
        let response = await this.request(currentUrl);

        if(response.status<300 || response.status>=400){
            throw new Error(`Expected redirect from /IIT_ERP3/, got ${response.status}`);
        }
        // let redirectCnt = 0;
        // while(response.status>=300 && response.status<400){
        //     const location = response.headers.get("Location"); // redirect url;
        //     if(!location)break;

        //     currentUrl = new URL(location,currentUrl).toString();
        //     response = await this.request(currentUrl);

        //     redirectCnt++;
        //     if(redirectCnt>5){
        //         throw new Error("Too many redirects on login page");
        //     }
        // }

        const location = response.headers.get("Location");
        if(!location){
            throw new Error ("No Location header in redirect from /IIT_ERP3/")
        }

        const redirectUrl = new URL(location,entryUrl);
    

        // const url = new URL(currentUrl);
        const sessionToken = redirectUrl.searchParams.get("sessionToken");
        const requestedUrl = redirectUrl.searchParams.get("requestedUrl");

        if(!sessionToken){
            throw new Error( "Failed to extract sessionToken from login page");
        }
            await this.request(redirectUrl.toString());
        return {
            sessionToken,
            requestedUrl:requestedUrl || `${this.baseUrl}/IIT_ERP3/menulist.htm`
        };
    }

    async getSecurityQuestion(rollNumber: string): Promise<string> {
        const url = `${this.baseUrl}/SSOAdministration/getSecurityQues.htm`;

        const body = new URLSearchParams({ user_id: rollNumber });

        const response = await this.request(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });

        const question = await response.text();

        if (!question || question.trim().length === 0) {
            throw new Error("Empty security question returned from ERP");
        }

        return question.trim();
    }

    // expose session for debugging , lets inspect cookies from outside

    getSession() : ErpSession{
        return this.session;
    }


}