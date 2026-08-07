// ============================================================================
//  Arranca el doble de Google POR SU CUENTA, para probar a mano en el navegador.
//
//    node lib/test/doble-google-suelto.mts
//
//  (Node 22 quita los tipos solo; no hace falta tsx ni compilar nada.)
//
//  Y el servidor de Next con:
//    GOOGLE_OAUTH=1
//    GOOGLE_CLIENT_ID=cliente-de-prueba.apps.googleusercontent.com
//    GOOGLE_CLIENT_SECRET=secreto-de-prueba
//    GOOGLE_AUTH_ENDPOINT=http://127.0.0.1:3312/auth
//    GOOGLE_TOKEN_ENDPOINT=http://127.0.0.1:3312/token
//
//  Las pruebas automáticas NO usan esto: montan el doble ellas mismas. Esto es
//  solo para hacer clic y ver el flujo entero sin credenciales de Google.
//
//  `google-oauth.ts` solo acepta estos sustitutos si apuntan a loopback, así
//  que dejarse una variable puesta no puede desviar el acceso a un tercero.
// ============================================================================
// Con extensión: en ESM el especificador no se resuelve solo.
import { arrancarDoble, AUTH_DOBLE, ENDPOINT_DOBLE, CLIENT_ID_PRUEBA } from './doble-google.ts'

await arrancarDoble()
console.log('Doble de Google escuchando.')
console.log('  consentimiento :', AUTH_DOBLE)
console.log('  canje de token :', ENDPOINT_DOBLE)
console.log('  client_id      :', CLIENT_ID_PRUEBA)
console.log('\nCtrl+C para pararlo.')
