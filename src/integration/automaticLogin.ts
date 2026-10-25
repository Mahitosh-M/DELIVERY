import type {ConnectedIdentity,Issuer} from './connection';
export type LoginAttempt=(issuer:Issuer,email:string,password:string)=>Promise<ConnectedIdentity>;
/** Try only the two approved projects. Roles still come from the trusted bridge. */
export async function loginAutomatically(email:string,password:string,attempt:LoginAttempt,preferred:Issuer='delivery-28165'):Promise<ConnectedIdentity>{
 const issuers:Issuer[]=preferred==='cisapp-236ab'?['cisapp-236ab','delivery-28165']:['delivery-28165','cisapp-236ab'];
 let accessError:unknown;
 for(const issuer of issuers){
  try{return await attempt(issuer,email.trim(),password);}
  catch(error){
   const failure=error as {code?:string;status?:number};
   if(failure.status===403){accessError=error;continue;}
   if(['auth/invalid-credential','auth/user-not-found','auth/wrong-password','auth/invalid-login-credentials'].includes(failure.code??''))continue;
   // Never retry blocked accounts, rate limits, network or backend failures in another project.
   throw error;
  }
 }
 if(accessError)throw accessError;
 throw new Error('Email or password is incorrect. Please try again.');
}
