'use strict';
function sendMessengerMessage({socket,log,text,payload,onSent}) {
  const message={...payload,clientId:crypto.randomUUID()};
  const row=document.createElement('div'), body=document.createElement('span');
  const status=document.createElement('small'), retry=document.createElement('button');
  row.className='msg me';body.textContent=text;
  status.setAttribute('role','status');retry.type='button';retry.textContent='Retry';
  row.append(body,' ',status,' ',retry);log.append(row);
  const attempt=()=>{
    retry.hidden=true;status.textContent='Sending…';log.scrollTop=log.scrollHeight;
    const failed=reason=>{status.textContent=reason;retry.hidden=false;};
    const client=socket();
    if(!client?.connected){failed('Offline. Reconnect to retry.');return;}
    client.timeout(8000).emit('m:im',message,(error,result)=>{
      if(error || !result?.ok){failed(result?.error || 'Send unconfirmed.');return;}
      row.remove();onSent(result);
    });
  };
  retry.addEventListener('click',attempt);attempt();
}
