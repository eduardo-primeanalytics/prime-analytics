(function(){
  function record(eventName){
    var payload = JSON.stringify({
      event: eventName,
      path: window.location.pathname
    });

    if(navigator.sendBeacon){
      navigator.sendBeacon('/__events', new Blob([payload], {type:'application/json'}));
      return;
    }

    fetch('/__events', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:payload,
      keepalive:true,
      credentials:'same-origin'
    }).catch(function(){});
  }

  document.addEventListener('click', function(event){
    var target = event.target.closest('[data-event]');
    if(target){
      record(target.getAttribute('data-event'));
    }
  });
})();
