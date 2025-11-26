import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Button } from 'react-bootstrap';

function ConfirmDelete({ show, bookTitle, onCancel, onConfirm, isLoading }) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>Delete Book</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0">
          Are you sure you want to delete
          <strong> {bookTitle || 'this book'} </strong>
          from the catalog? This action cannot be undone.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? 'Deleting…' : 'Delete'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

ConfirmDelete.propTypes = {
  show: PropTypes.bool.isRequired,
  bookTitle: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

ConfirmDelete.defaultProps = {
  bookTitle: '',
  isLoading: false,
};

export default ConfirmDelete;
