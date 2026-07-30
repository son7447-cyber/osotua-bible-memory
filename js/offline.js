(() => {
  const DB_NAME="osotua-offline";
  const DB_VERSION=1;
  const STORE="pending";

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE)){
          db.createObjectStore(STORE,{keyPath:"id"});
        }
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }

  async function withStore(mode,operation){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode);
      const store=tx.objectStore(STORE);
      const request=operation(store);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      tx.oncomplete=()=>db.close();
    });
  }

  const api={
    async add(item){
      return withStore("readwrite",store=>store.put(item));
    },
    async update(item){
      return withStore("readwrite",store=>store.put(item));
    },
    async remove(id){
      return withStore("readwrite",store=>store.delete(id));
    },
    async all(){
      return withStore("readonly",store=>store.getAll());
    },
    async count(){
      return withStore("readonly",store=>store.count());
    }
  };

  window.OSOTUA_QUEUE=api;
})();
