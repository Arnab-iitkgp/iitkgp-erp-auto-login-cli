export class ErpSession {   
    private cookies: Map<string,string> = new Map();

    setCookiesFromResponse(response:Response):void{
        // getSetCookie() returns an array — one entry per Set-Cookie header
        // eg. ["JSESSIONID=ABC123; Path=/; HttpOnly", "ssoToken=XYZ; Path=/"]
        const setCookieHeaders = response.headers.getSetCookie();

        for(const header of setCookieHeaders){
            // we are extracting like "JSESSIONID=ABCD123"
            const nameValue = header.split(";")[0];
            if(!nameValue)continue;

            const eqidx = nameValue?.indexOf("=");
            if(eqidx===-1)continue;

            const name = nameValue.substring(0, eqidx).trim();
            const value = nameValue.substring(eqidx + 1).trim();
            this.cookies.set(name, value);
        }
    }

    // build the cookie header string to send with fetch req;
    getCookieHeader():string{
        return Array.from(this.cookies.entries()).map(([name,value]) => `${name}=${value}`).join("; ");
    }
    // Get a specific cookie value by name (eg "ssoToken")
    get(name: string): string | undefined {
    return this.cookies.get(name);
  }

}