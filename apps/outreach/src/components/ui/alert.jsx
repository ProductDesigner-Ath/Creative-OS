import * as React from 'react';
import {cn} from '@/lib/utils';

function Alert({className,role='alert',...props}){
 return <div data-slot="alert" role={role} className={cn('feedback',className)} {...props}/>;
}
function AlertDescription({className,...props}){
 return <div data-slot="alert-description" className={cn('feedback-description',className)} {...props}/>;
}
export {Alert,AlertDescription};
