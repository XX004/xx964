function RegisterForm({ 
  showRegisterModal, 
  setShowRegisterModal, 
  registerForm, 
  setRegisterForm, 
  registerUser, 
  loading 
}) {
  if (!showRegisterModal) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Register Your Account</h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setShowRegisterModal(false)}
            ></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="Enter your name"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Age</label>
              <input 
                type="number" 
                className="form-control"
                placeholder="Enter your age"
                value={registerForm.age}
                onChange={(e) => setRegisterForm({...registerForm, age: e.target.value})}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input 
                type="email" 
                className="form-control"
                placeholder="Enter your email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowRegisterModal(false)}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={registerUser}
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterForm;