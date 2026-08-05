import { createPost, getXApiStatus } from './src/xApi.js';
const text = process.env.POST_TEXT || '';
const st = getXApiStatus();
if (!st.ok) {
  console.error('X_NOT_CONFIGURED', st.reason);
  process.exit(2);
}
const r = await createPost(text);
console.log(JSON.stringify(r, null, 2));
