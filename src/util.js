'use strict';

import getConfig from './config';

let
  slice = Array.prototype.slice,

  mPow = Math.pow,
  mRound = Math.round,
  mFloor = Math.floor,
  mRandom = Math.random,
  config = getConfig(),
  // context = config.context,
  // floor = function(value){
  //  return value | 0;
  // },

  noteLengthNames = {
      1: 'quarter',
      2: 'eighth',
      4: 'sixteenth',
      8: '32th',
      16: '64th'
  };


export function typeString(o){
  if(typeof o != 'object'){
    return typeof o;
  }

  if(o === null){
    return 'null';
  }

  //object, array, function, date, regexp, string, number, boolean, error
  let internalClass = Object.prototype.toString.call(o).match(/\[object\s(\w+)\]/)[1];
  return internalClass.toLowerCase();
}



export function ajax(config){
  let
    request = new XMLHttpRequest(),
    method = config.method === undefined ? 'GET' : config.method,
    fileSize;

  function executor(resolve, reject){

    reject = reject || function(){};
    resolve = resolve || function(){};

    request.onload = function(){
      if(request.status !== 200){
        reject(request.status);
        return;
      }

      if(config.responseType === 'json'){
        fileSize = request.response.length;
        request = null;
        resolve(JSON.parse(request.response), fileSize);
      }else{
        request = null;
        resolve(request.response);
      }
    };

    request.onerror = function(e){
        config.onError(e);
    };

    request.open(method, config.url, true);

    if(config.overrideMimeType){
        request.overrideMimeType(config.overrideMimeType);
    }

    if(config.responseType){
        if(config.responseType === 'json'){
            request.responseType = 'text';
        }else{
            request.responseType = config.responseType;
        }
    }

    if(method === 'POST') {
        request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    }

    if(config.data){
        request.send(config.data);
    }else{
        request.send();
    }
  }

  return new Promise(executor);
}


function parseSample(sample, id, every){
  return new Promise(function(resolve, reject){
    try{
      config.context.decodeAudioData(sample,
        function onSuccess(buffer){
          //console.log(id, buffer);
          if(id !== undefined){
            resolve({'id': id, 'buffer': buffer});
            if(every){
              every({'id': id, 'buffer': buffer});
            }
          }else{
            resolve(buffer);
            if(every){
              every(buffer);
            }
          }
      },
      function onError(e){
        //console.log('error decoding audiodata', id, e);
        //reject(e); // don't use reject because we use this as a nested promise and we don't want the parent promise to reject
        if(id !== undefined){
          resolve({'id': id, 'buffer': undefined});
        }else{
          resolve(undefined);
        }
      }
    );
    }catch(e){
      //console.log('error decoding audiodata', id, e);
      //reject(e);
      if(id !== undefined){
        resolve({'id': id, 'buffer': undefined});
      }else{
        resolve(undefined);
      }
    }
  });
}


function loadAndParseSample(url, id, every){
  return new Promise(function executor(resolve, reject){
    ajax({url: url, responseType: 'arraybuffer'}).then(
      function onFulfilled(data){
        parseSample(data, id, every).then(resolve, reject);
      },
      function onRejected(){
        if(id !== undefined){
          resolve({'id': id, 'buffer': undefined});
        }else{
          resolve(undefined);
        }
      }
    );
  });
}


export function parseSamples(mapping, every){
  let key, sample,
    promises = [],
    type = typeString(mapping);

  every = typeString(every) === 'function' ? every : false;
  //console.log(type, mapping)
  if(type === 'object'){
    for(key in mapping){
      if(mapping.hasOwnProperty(key)){
        sample = mapping[key];
        if(sample.indexOf('http://') === -1){
          promises.push(parseSample(base64ToBinary(sample), key, every));
        }else{
          promises.push(loadAndParseSample(sample, key, every));
        }
      }
    }
  }else if(type === 'array'){
    mapping.forEach(function(sample){
      if(sample.indexOf('http://') === -1){
        promises.push(parseSample(base64ToBinary(sample), every));
      }else{
        promises.push(loadAndParseSample(sample, every));
      }
    });
  }

  return new Promise(function(resolve, reject){
    Promise.all(promises).then(
      function onFulfilled(values){
        if(type === 'object'){
          let mapping = {};
          values.forEach(function(value){
            mapping[value.id] = value.buffer;
          });
          //console.log(mapping);
          resolve(mapping);
        }else if(type === 'array'){
          resolve(values);
        }
      },
      function onRejected(e){
        reject(e);
      }
    );
  });
}



// adapted version of https://github.com/danguer/blog-examples/blob/master/js/base64-binary.js
function base64ToBinary(input){
  let keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
    bytes, uarray, buffer,
    lkey1, lkey2,
    chr1, chr2, chr3,
    enc1, enc2, enc3, enc4,
    i, j = 0;

  bytes = Math.ceil((3 * input.length) / 4.0);
  buffer = new ArrayBuffer(bytes);
  uarray = new Uint8Array(buffer);

  lkey1 = keyStr.indexOf(input.charAt(input.length-1));
  lkey2 = keyStr.indexOf(input.charAt(input.length-1));
  if(lkey1 == 64) bytes--; //padding chars, so skip
  if(lkey2 == 64) bytes--; //padding chars, so skip

  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');

  for(i = 0; i < bytes; i += 3) {
    //get the 3 octects in 4 ascii chars
    enc1 = keyStr.indexOf(input.charAt(j++));
    enc2 = keyStr.indexOf(input.charAt(j++));
    enc3 = keyStr.indexOf(input.charAt(j++));
    enc4 = keyStr.indexOf(input.charAt(j++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    uarray[i] = chr1;
    if(enc3 != 64) uarray[i+1] = chr2;
    if(enc4 != 64) uarray[i+2] = chr3;
  }
  //console.log(buffer);
  return buffer;
}
