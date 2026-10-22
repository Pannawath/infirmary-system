import type {ReactNode} from 'react';
export function WorkspaceHeader({action}:{icon:ReactNode;title:string;description:string;action?:ReactNode}){
 return action?<div className="workspace-actions-only print-hidden">{action}</div>:null;
}
export function WorkspaceEmpty({icon,title,description}:{icon:ReactNode;title:string;description:string}){return <div className="workspace-empty"><span>{icon}</span><h3>{title}</h3><p>{description}</p></div>}
