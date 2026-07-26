import { test } from 'node:test';
import assert from 'node:assert';
import { renderRoleModal, renderAppHeader } from '../lib/shell.js';

test('role modal lists three roles with admin enabled and the others disabled', () => {
  const html = renderRoleModal();
  // overlay starts hidden, addressable by id
  assert.match(html, /class="overlay hidden" id="roleModal"/);
  // all three roles present
  assert.match(html, /Admin/);
  assert.match(html, /Specialist/);
  assert.match(html, /Operator/);
  // only admin is actionable
  assert.match(html, /data-action="pick-role" data-role="admin"/);
  assert.match(html, /Continue/);
  // exactly two disabled rows carry the requires-auth tag
  assert.equal((html.match(/requires auth/g) || []).length, 2);
  // scope lines communicate the intended authorization scoping
  assert.match(html, /Sees only their own operator board/);
  assert.match(html, /Manager sees across all specialists/);
});

test('app header renders the operator title, eyebrow, and ADM identity chip', () => {
  const html = renderAppHeader('operator');
  assert.match(html, /Pipeline · layer 2 of 3/);
  assert.match(html, /Operator board — for human review/);
  assert.match(html, /class="ava">ADM</);
  assert.match(html, /data-action="switch-role"/);
});

test('app header renders the correct title per view', () => {
  assert.match(renderAppHeader('agent'), /layer 1 of 3/);
  assert.match(renderAppHeader('agent'), /Virtual agent — pipeline monitor/);
  assert.match(renderAppHeader('specialist'), /layer 3 of 3/);
  assert.match(renderAppHeader('specialist'), /Specialist board — for fraud/);
});

test('app header falls back to the agent header for an unknown view', () => {
  assert.match(renderAppHeader('nope'), /layer 1 of 3/);
});
