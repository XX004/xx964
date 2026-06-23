const CreateCampaignForm = ({
  title, setTitle,
  description, setDescription,
  goal, setGoal,
  duration, setDuration,
  timeUnit, setTimeUnit,
  handleCreateCampaign,
  loading, account }) => (
  <div className="card mb-4">
      <div className="card-body">
        <h5 className="card-title">Create New Campaign</h5>
        <div>
          <div className="mb-3">
            <input 
              type="text" 
              className="form-control" 
              placeholder="Campaign Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <textarea 
              className="form-control" 
              placeholder="Campaign Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
            />
          </div>
          <div className="mb-3">
            <input 
              type="number" 
              className="form-control" 
              placeholder="Goal (ETH)"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              step="0.01"
            />
          </div>
          <div className="mb-3 row">
            <div className="col-8">
              <input 
                type="number" 
                className="form-control" 
                placeholder="Duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="col-4">
              <select 
                className="form-select"
                value={timeUnit}
                onChange={(e) => setTimeUnit(e.target.value)}
              >
               <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={handleCreateCampaign}
            disabled={!account || loading}
          >
            {loading ? "Creating..." : "Create Campaign"}
          </button>
        </div>
      </div>
    </div>
);
export default CreateCampaignForm;