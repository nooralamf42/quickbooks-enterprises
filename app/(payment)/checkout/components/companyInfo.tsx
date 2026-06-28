// components/CompanyInfo.js
export default function CompanyInfo({ companyName, ein, onChange }:{companyName: string, ein?: string, onChange: (field: string, value: string) => void}) {
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
              type="text"
              id="ein"
              placeholder="123-45-6789"
              value={ein || ''}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val.length > 9) val = val.slice(0, 9);
                if (val.length > 5) {
                  val = val.slice(0, 3) + '-' + val.slice(3, 5) + '-' + val.slice(5);
                } else if (val.length > 3) {
                  val = val.slice(0, 3) + '-' + val.slice(3);
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