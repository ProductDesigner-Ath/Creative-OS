import React from 'react';
import {CircleAlert,TriangleAlert,CircleCheck,Info} from 'lucide-react';
import {Alert,AlertDescription} from '@/components/ui/alert';
const variants={error:[CircleAlert,'Error'],warning:[TriangleAlert,'Warning'],success:[CircleCheck,'Success'],info:[Info,'Information']};
export default function Feedback({tone='info',children,action}){
 const [Icon,label]=variants[tone]||variants.info;
 return <Alert className={'feedback-'+tone} role={tone==='error'?'alert':'status'}><Icon aria-hidden="true"/><AlertDescription><span className="sr-only">{label}: </span>{children}</AlertDescription>{action&&<div className="feedback-action">{action}</div>}</Alert>;
}
