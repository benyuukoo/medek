#!/usr/bin/env node
// Generates the Contract v1 router workflow JSON
// Fixes: CID leftValue, leading spaces, caseSensitive, adds fallback, error handling per branch

const SUBWORKFLOWS = [
  { output: 'Facture PLS',   wfId: 'T4MQopyAWY1v8h7N', wfName: 'Medek — Import Facture PLS',          y: 48 },
  { output: 'Stock PLS',     wfId: '4zigEyNSCwtFGIzl', wfName: 'Medek — Import Stock PLS',             y: 240 },
  { output: 'CID',           wfId: 'IhFf3Ct0TYvRnI6E', wfName: 'Medek — Import Invoice CONSIDER IT DONE', y: 432 },
  { output: 'FINIFAC',       wfId: 'vg0CGxoCMONudAJa', wfName: 'Medek — FINIFAC – Encaissement Carrefour → Paiement factures Zoho', y: 624 },
  { output: 'VENTES',        wfId: 'zvcDHce7yiN32aOr', wfName: 'Medek — Import Ventes Magasin',        y: 816 },
  { output: 'CW',            wfId: 'mAVfdmjFyHrLVxte', wfName: 'Medek — Import CW',                    y: 1008 },
  { output: 'Kuehne',        wfId: 'gG7UXfOyDokykLAb', wfName: 'Medek — Import Facture Kuehne',        y: 1200 },
  { output: 'SALAIRES',      wfId: 'an83468N5ZqJzIe4', wfName: 'Medek — Import Expense Salaires',      y: 1392 },
  { output: 'Serge',         wfId: 'uKlGVkXKPZ8IsVrY', wfName: 'Medek — Import Facture Serge',         y: 1584 },
  { output: 'HERPORT',       wfId: 'T7AWC7eXIzhsVaUi', wfName: 'Medek — Import Facture Herport',       y: 1776 },
  { output: 'Schouttet',     wfId: 'I8broe28tNF8usqQ', wfName: 'Medek — Import Facture Schouttet',     y: 1968 },
  { output: 'BL EDI',        wfId: '7fnwGlynh3YT5qkB', wfName: 'Medek — Import BL EDI',                y: 2160 },
];

// Switch rules (index matches SUBWORKFLOWS order for first 8, then fieccor/HERPORT/schouttet/FRANCEMEDEK)
const SWITCH_RULES = [
  { email: 'no-reply@invoice.tiime.fr',    label: 'Facture PLS' },
  { email: 'hedy@plservice.fr',            label: 'Stock PLS' },
  { email: 'exploitation@consideritdone.fr', label: 'consider it done', leftValueFix: true },
  { email: 'SFF_CARREFOUR@carrefour.com',  label: 'FINIFAC' },
  { email: 'ferid_mazari@carrefour.com',   label: 'VENTES MAGASIN' },
  { email: 'cw@saylinternational.com',     label: 'CW' },
  { email: 'no.reply@basware.com',         label: 'Kuehne' },
  { email: 'bastin.thierry@wanadoo.fr',    label: 'SALAIRES' },
  { email: 'c.dinar@fieccor.fr',           label: 'fieccor' },     // → Serge workflow
  { email: 'a.guerin@herport.fr',          label: 'HERPORT' },
  { email: 'comptabilite@schouttet.fr',    label: 'schouttet' },
  { email: 'francemedek@gmail.com',        label: 'FRANCE MEDEK' }, // → BL EDI workflow
];

function makeRule(rule) {
  return {
    conditions: {
      options: {
        caseSensitive: false,  // FIX: was true
        leftValue: '',
        typeValidation: 'strict',
        version: 3
      },
      conditions: [{
        leftValue: rule.leftValueFix === true
          ? '={{ $json.from.value[0].address }}'  // FIX: CID was empty "="
          : '={{ $json.from.value[0].address }}',
        rightValue: rule.email,  // FIX: leading spaces removed
        operator: { type: 'string', operation: 'equals', name: 'filter.operator.equals' }
      }],
      combinator: 'and'
    },
    renameOutput: true,
    outputKey: rule.label
  };
}

function makeExecNode(sw, idx) {
  const name = "Call '" + sw.output + "'";
  return {
    parameters: {
      workflowId: {
        __rl: true,
        value: sw.wfId,
        mode: 'list',
        cachedResultUrl: '/workflow/' + sw.wfId,
        cachedResultName: sw.wfName
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {},
        matchingColumns: [],
        schema: [],
        attemptToConvertTypes: false,
        convertFieldsToString: true
      },
      options: {}
    },
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.3,
    position: [2944, sw.y],
    name: name,
    continueOnFail: true   // NEW: per-branch error handling
  };
}

function makeIfErrorNode(sw, idx) {
  const name = "Error? " + sw.output;
  return {
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'loose',
          version: 3
        },
        conditions: [{
          leftValue: '={{ $json.error }}',
          rightValue: '',
          operator: { type: 'string', operation: 'exists', name: 'filter.operator.exists' }
        }],
        combinator: 'and'
      }
    },
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position: [3200, sw.y],
    name: name
  };
}

// Build nodes array
const nodes = [];
const connections = {};

// 1. Gmail Trigger (updated query)
nodes.push({
  parameters: {
    pollTimes: { item: [{ mode: 'everyHour' }] },
    simple: false,
    filters: {
      q: '-{label:imported} -{label:error} -{label:unrouted} has:attachment',
      readStatus: 'unread'
    },
    options: { downloadAttachments: true }
  },
  type: 'n8n-nodes-base.gmailTrigger',
  typeVersion: 1.3,
  position: [2224, 1200],
  name: 'Gmail Trigger'
});

// 2. Switch (with all fixes)
nodes.push({
  parameters: {
    rules: {
      values: SWITCH_RULES.map(makeRule)
    },
    options: {
      fallbackOutput: 'extra',
      renameFallbackOutput: 'unrouted'
    }
  },
  type: 'n8n-nodes-base.switch',
  typeVersion: 3.4,
  position: [2448, 944],
  name: 'Switch'
});

// 3. ExecuteWorkflow + IF error nodes
SUBWORKFLOWS.forEach(function(sw, idx) {
  nodes.push(makeExecNode(sw, idx));
  nodes.push(makeIfErrorNode(sw, idx));
});

// 4. Shared success path
nodes.push({
  parameters: {
    operation: 'addLabels',
    messageId: "={{ $('Gmail Trigger').item.json.id }}",
    labelIds: ['Label_5420650119621021264']
  },
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.1,
  position: [3504, 1104],
  name: 'Marquer email importé'
});

nodes.push({
  parameters: {
    operation: 'markAsRead',
    messageId: "={{ $('Gmail Trigger').first().json.id }}"
  },
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.2,
  position: [3728, 1104],
  name: 'Mark a message as read'
});

// 5. Unrouted fallback path
nodes.push({
  parameters: {
    operation: 'addLabels',
    messageId: "={{ $('Gmail Trigger').item.json.id }}",
    labelIds: ['Label_4750124165477147534']
  },
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.2,
  position: [3504, 2500],
  name: 'Label unrouted'
});

nodes.push({
  parameters: {
    operation: 'markAsRead',
    messageId: "={{ $('Gmail Trigger').first().json.id }}"
  },
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.2,
  position: [3728, 2500],
  name: 'Mark unrouted as read'
});

nodes.push({
  parameters: {
    sendTo: 'gestion.medek@gmail.com',
    subject: "=[n8n] Unrouted email from {{ $('Gmail Trigger').item.json.from.value[0].address }} — {{ $('Gmail Trigger').item.json.subject }}",
    emailType: 'html',
    message: "=<h2>Unrouted email received</h2><p>An email with attachments was received but did not match any routing rule.</p><table style=\"border-collapse:collapse;font-family:sans-serif;font-size:14px\"><tr><td style=\"padding:4px 12px 4px 0;color:#666\">From</td><td>{{ $('Gmail Trigger').item.json.from.value[0].address }}</td></tr><tr><td style=\"padding:4px 12px 4px 0;color:#666\">Subject</td><td>{{ $('Gmail Trigger').item.json.subject }}</td></tr><tr><td style=\"padding:4px 12px 4px 0;color:#666\">Date</td><td>{{ $('Gmail Trigger').item.json.date }}</td></tr></table><p>The email has been labeled <b>unrouted</b> and will not be reprocessed.</p><hr><p style=\"color:#888;font-size:12px\">Automated notification from n8n</p>",
    options: { appendAttribution: false }
  },
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.2,
  position: [3952, 2500],
  name: 'Send unrouted notification'
});

// 6. Disabled Get many messages (preserved from existing)
nodes.push({
  parameters: {
    operation: 'getAll',
    limit: 10,
    simple: false,
    filters: {
      q: '-{label:imported} -{label:error} -{label:unrouted} has:attachment',
      readStatus: 'unread'
    },
    options: { downloadAttachments: true }
  },
  type: 'n8n-nodes-base.gmail',
  typeVersion: 2.2,
  position: [2224, 1008],
  name: 'Get many messages',
  disabled: true
});

// Build connections
connections['Gmail Trigger'] = {
  main: [[{ node: 'Switch', type: 'main', index: 0 }]]
};

// Switch → executeWorkflow (12 outputs + 1 fallback)
const switchOutputs = SUBWORKFLOWS.map(function(sw) {
  return [{ node: "Call '" + sw.output + "'", type: 'main', index: 0 }];
});
// Add fallback output (index 12)
switchOutputs.push([{ node: 'Label unrouted', type: 'main', index: 0 }]);
connections['Switch'] = { main: switchOutputs };

// executeWorkflow → IF error
SUBWORKFLOWS.forEach(function(sw) {
  const execName = "Call '" + sw.output + "'";
  const ifName = "Error? " + sw.output;
  connections[execName] = {
    main: [[{ node: ifName, type: 'main', index: 0 }]]
  };
  // IF true (error exists, output 0) → nothing (end)
  // IF false (no error, output 1) → Label imported
  connections[ifName] = {
    main: [
      [],  // output 0 (true/error) → dead end
      [{ node: 'Marquer email importé', type: 'main', index: 0 }]  // output 1 (false/success)
    ]
  };
});

// Label imported → Mark as read
connections['Marquer email importé'] = {
  main: [[{ node: 'Mark a message as read', type: 'main', index: 0 }]]
};

// Unrouted path
connections['Label unrouted'] = {
  main: [[{ node: 'Mark unrouted as read', type: 'main', index: 0 }]]
};
connections['Mark unrouted as read'] = {
  main: [[{ node: 'Send unrouted notification', type: 'main', index: 0 }]]
};

// Get many messages → Switch (disabled, but keep connection)
connections['Get many messages'] = {
  main: [[{ node: 'Switch', type: 'main', index: 0 }]]
};

const workflow = {
  name: 'Handle Gmail Incoming Emails',
  settings: {
    executionOrder: 'v1',
    errorWorkflow: 'pMiLFPl5uTYRH0EI',
    availableInMCP: true
  },
  nodes: nodes,
  connections: connections
};

const json = JSON.stringify(workflow, null, 2);
process.stdout.write(json);
