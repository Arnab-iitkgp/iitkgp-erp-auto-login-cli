import { ErpSession } from "./session.js";

export class ErpClient{
    private session : ErpSession;
    private baseUrl:string;
    private sessionToken: string = "";
    private requestedUrl: string = "";
    
    constructor(baseUrl:string){
        this.session = new ErpSession();
        this.baseUrl= baseUrl;
    }

    //every req goes thru this, 
    //-- attaches stored cookies, capture new cookies from the response
    //-- does not follow redirect (then manual handling)

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

        // Store on instance so other methods (requestOtp, authenticate) can use them
        this.sessionToken = sessionToken;
        this.requestedUrl = requestedUrl || `${this.baseUrl}/IIT_ERP3/menulist.htm`;

        await this.request(redirectUrl.toString());
        return {
            sessionToken: this.sessionToken,
            requestedUrl: this.requestedUrl,
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

    async requestOtp(rollNumber: string, password: string, answer: string):Promise<string>{
        // Note: ERP has a typo-- "getEmilOTP" not "getEmailOTP" // #CHECK
        const url = `${this.baseUrl}/SSOAdministration/getEmilOTP.htm`;
        const body = new URLSearchParams({
            user_id: rollNumber,
            password: password,
            answer: answer,
            typeee: "SI",
            email_otp: "",
            sessionToken: this.sessionToken,
            requestedUrl: this.requestedUrl,
        });

        const response = await this.request(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
        });

        const responseText = await response.text();
        return responseText.trim();
    }

    async fetchAllSecurityQuestions(
        rollNumber: string,
        maxAttempts: number = 15
    ): Promise<string[]> {
        const found = new Set<string>();

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const q = await this.getSecurityQuestion(rollNumber);
                if (q && q !== 'FALSE') {
                    found.add(q.trim());
                }
                
                if (found.size >= 3) break;
            } catch {
                //safe ignore
            }
        }

        return Array.from(found);
    }

    async authenticate(
        rollNumber:string,
        password:string,
        answer:string,
        otp:string
    ):Promise<string>{
        const url = `${this.baseUrl}/SSOAdministration/auth.htm`
        const body =  new URLSearchParams({
            user_id: rollNumber,
            password: password,
            answer: answer,
            typeee: "SI",
            email_otp: otp,
            sessionToken: this.sessionToken,
            requestedUrl: this.requestedUrl,
        });

        const authResponse = await this.request(url, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: body.toString(),
        })

         if (authResponse.status < 300 || authResponse.status >= 400) {
            const text = await authResponse.text();
            throw new Error(`Auth failed (status ${authResponse.status}): ${text.substring(0, 200)}`);
        }

        const successLocation = authResponse.headers.get("Location");

        if(!successLocation){
            throw new Error("No redirect after auth.htm");
        }

        const successUrl = new URL(successLocation, url).toString();
        const successResponse = await this.request(successUrl);

        const ssoToken = this.session.get("ssoToken");

        if(!ssoToken){
            //fallback: try extract from the location header url
            const finalLocation = successResponse.headers.get("Location");
            if(finalLocation){
                const finalUrl = new URL(finalLocation, successUrl);
                const tokenFromUrl = finalUrl.searchParams.get("ssotoken");

                if(tokenFromUrl)return tokenFromUrl;
            }
            throw new Error("Failed to extract ssoToken from auth response")
        }
        return ssoToken;
    }

    getSession() : ErpSession{
        return this.session;
    }

    /**
     * If expired, ERP 302s to /SSOAdministration/logout.htm.
     * If alive, ERP 302s to the actual dashboard.
     **/
    static async sessionAlive(
        erpUrl: string,
        ssoToken: string
    ): Promise<boolean> {
        const testUrl = `${erpUrl}/IIT_ERP3/home.htm?ssoToken=${ssoToken}`;

        try {
            const response = await fetch(testUrl, { redirect: "manual" });
            const location = response.headers.get("Location") || "";
            // Dead token -- redirects to logout.htm
            return !location.includes("logout.htm");
        } catch {
            return false;
        }
    }
}