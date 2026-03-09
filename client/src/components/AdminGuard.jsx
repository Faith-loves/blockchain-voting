import { Navigate } from "react-router-dom";
import { getSession } from "../utils/auth";

export default function AdminGuard({children}){
 const s = getSession();
 if(!s || s.user.role !== "admin")
   return <Navigate to="/dashboard" replace/>;

 return children;
}