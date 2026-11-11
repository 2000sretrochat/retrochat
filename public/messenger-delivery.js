'use strict';
function sendMessengerMessage({socket,log,text,payload,onSent,avatar,onRejected}) {
  const message={...payload,clientId:crypto.randomUUID()};
  const row=document.createElement('div'), body=document.createElement('div'), content=document.createElement('span');
  const status=document.createElement('small'), retry=document.createElement('button');
  row.className='msg transcript-message';
  body.className='bb';
  content.className='message-text';
  content.textContent=text;
  if(avatar)row.insertAdjacentHTML('afterbegin',avatar);
  status.setAttribute('role','status');retry.type='button';retry.textContent='Retry';
  body.append(content,' ',status,' ',retry);row.append(body);log.append(row);
  const attempt=()=>{
    retry.hidden=true;status.textContent='Sending…';log.scrollTop=log.scrollHeight;
    const failed=reason=>{status.textContent=reason;retry.hidden=false;};
    const client=socket();
    if(!client?.connected){failed('Offline. Reconnect to retry.');return;}
    client.timeout(8000).emit('m:im',message,(error,result)=>{
      if(error){failed('Send unconfirmed.');return;}
      if(!result?.ok){
        status.textContent='Not sent';
        onRejected?.(result?.error || 'Your message could not be sent.');
        return;
      }
      row.remove();onSent(result);
    });
  };
  retry.addEventListener('click',attempt);attempt();
}
