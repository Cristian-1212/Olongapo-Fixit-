'use strict';

const ID_REQUIREMENTS = Object.freeze({
  'Philippine National ID (PhilID/ePhilID)': {
    uploadMode: 'back',
    reason: 'The National ID back may contain its QR or verification details.'
  },
  'PhilHealth ID': {
    uploadMode: 'front',
    reason: 'The front is sufficient for the member name and identification number.'
  },
  UMID: {
    uploadMode: 'back',
    reason: 'The UMID card may require the reverse side for verification details.'
  },
  "Philippine Driver's License": {
    uploadMode: 'front',
    reason: 'Identity details are printed on the front; the back is an emergency-contact section.'
  },
  'Philippine Passport': {
    uploadMode: 'front',
    reason: 'The photo and biographic page contain the identity and document details.'
  },
  'Postal ID': {
    uploadMode: 'front',
    reason: 'The current registration flow requires the identity face of the Postal ID.'
  },
  "Voter's ID": {
    uploadMode: 'back',
    reason: 'Voter ID layouts vary; the reverse side may contain verification details.'
  },
  'Barangay Residency Document': {
    uploadMode: 'front',
    reason: 'A Barangay Residency Document is verified from its issued face.'
  }
});

function getIdRequirement(documentType) {
  return ID_REQUIREMENTS[documentType] || null;
}

module.exports = { ID_REQUIREMENTS, getIdRequirement };
