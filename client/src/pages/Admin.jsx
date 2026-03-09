import { useEffect,useState } from "react";
import { API_BASE_URL } from "../config";

export default function Admin(){
 const [votes,setVotes]=useState([]);

 useEffect(()=>{
   fetch(`${API_BASE_URL}/api/admin/results`,{
     credentials:"include"
   })
   .then(r=>r.json())
   .then(d=>setVotes(d.votes||[]));
 },[]);

 return(
   <div style={{padding:40,color:"white"}}>
     <h1>Admin Panel</h1>
     <p>Total votes: {votes.length}</p>

     {votes.map(v=>(
       <div key={v._id} style={{marginBottom:10}}>
         {v.voterMatric}
       </div>
     ))}
   </div>
 );
}
