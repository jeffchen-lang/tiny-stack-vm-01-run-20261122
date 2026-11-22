// Tiny stack VM (make.fun tiny stack ISA v1): /input/<id>/{program,input}.bin
// in, /output/<id>/{stdout.bin,exit.txt} out. Node 22, no dependencies.
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Stack effect per opcode byte: hex digit = pops*4 + pushes (index = opcode).
const T = '01146abf0000000099999995999599909990000000000000044000000000000058000000000000004414';
// Binary ops 0x10-0x22 by (op-16); slots 7, 11, 15 are the unary/invalid gaps.
const G = [(a, b) => (a + b) | 0, (a, b) => (a - b) | 0, Math.imul, (a, b) => a === -2147483648 && b === -1 ? a : (a / b) | 0, (a, b) => b === -1 ? 0 : (a % b) | 0, (a, b) => Math.floor((a >>> 0) / (b >>> 0)) | 0, (a, b) => ((a >>> 0) % (b >>> 0)) | 0, 0, (a, b) => a & b, (a, b) => a | b, (a, b) => a ^ b, 0, (a, b) => a << (b & 31), (a, b) => a >> (b & 31), (a, b) => (a >>> (b & 31)) | 0, 0, (a, b) => a === b ? 1 : 0, (a, b) => a < b ? 1 : 0, (a, b) => (a >>> 0) < (b >>> 0) ? 1 : 0];

function run(p, q) {
  const n = p.length;
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const o = new Uint8Array(65536);
  let s = 0, c = 0, ip = 0, pc = 0, st = 0, ol = 0;
  const end = (x) => [o.slice(0, ol), x];
  for (;;) {
    if (st === 1e6) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = p[pc];
    if (!(op < 8 || (op > 15 && op < 31) || (op > 31 && op < 35) || (op > 47 && op < 53) || (op > 63 && op < 66) || (op > 79 && op < 84))) return end(5);
    const im = op === 1 ? 1 : op === 2 ? 4 : op >= 48 && op <= 51 ? 2 : 0;
    if (pc + im >= n) return end(9);
    st++;
    const nx = pc + 1 + im;
    const t = parseInt(T[op], 16), po = t >> 2, pu = t & 3;
    if (s < po) return end(2);
    if (s - po + pu > 256) return end(3);
    pc = nx;
    if (op >= 16 && op <= 34 && op !== 23 && op !== 27 && op !== 31) {
      const b = D[s - 1], a = D[s - 2];
      if (op >= 19 && op <= 22 && !b) return end(4);
      s -= 2; D[s++] = G[op - 16](a, b);
      continue;
    }
    switch (op) {
      case 0: return end(0);
      case 1: D[s++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[s++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: { const x = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = x; break; }
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: { const a = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = a; break; }
      case 23: D[s - 1] = -D[s - 1] | 0; break;
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 48: pc = nx + (((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16); break;
      case 49: case 50: {
        const v = D[--s];
        if ((op === 49) === (v === 0)) pc = nx + (((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16);
        break;
      }
      case 51: if (c === 64) return end(7); C[c++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8); break;
      case 52: if (!c) return end(8); pc = C[--c]; break;
      case 64: { const a = D[s - 1]; if (a < 0 || a > 255) return end(6); D[s - 1] = M[a]; break; }
      case 65: { const a = D[s - 1], v = D[s - 2]; if (a < 0 || a > 255) return end(6); s -= 2; M[a] = v; break; }
      case 80: {
        const t = String(D[s - 1]);
        if (ol + t.length > 65536) return end(11);
        s--;
        for (let i = 0; i < t.length; i++) o[ol++] = t.charCodeAt(i);
        break;
      }
      case 81: if (ol + 1 > 65536) return end(11); o[ol++] = D[--s] & 255; break;
      case 82: D[s++] = ip < q.length ? q[ip++] : -1; break;
      case 83: return end(D[--s] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r[0]);
  writeFileSync(join(O, id, 'exit.txt'), `${r[1]}\n`);
}
