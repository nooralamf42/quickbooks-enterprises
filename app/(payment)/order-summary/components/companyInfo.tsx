// components/CompanyInfo.js
export default function CompanyInfo({ companyName, ein, onChange }:{companyName: string, ein: string, onChange: (field: string, value: string) => void}) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Company information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
              Company name
            </label>
            <input
              required
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => onChange('companyName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2ca01c] focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="ein" className="block text-sm font-medium text-gray-700 mb-2">
              EIN
            </label>
            <input
              required
              type="text"
              id="ein"
              placeholder="12-3456789"
              pattern="\d{2}-\d{7}"
              title="Format must be 9 digits: 12-3456789"
              value={ein}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val.length > 9) val = val.slice(0, 9);
                if (val.length > 2) {
                  val = val.slice(0, 2) + '-' + val.slice(2);
                }
                onChange('ein', val);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2ca01c] focus:border-transparent"
            />
          </div>
        </div>
      </div>
    );
  }