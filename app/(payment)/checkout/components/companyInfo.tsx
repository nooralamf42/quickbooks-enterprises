// components/CompanyInfo.js
export default function CompanyInfo({ companyName, onChange }:{companyName: string, onChange: (value: string) => void}) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Company information</h2>
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
            Company name
          </label>
          <input
            required
            type="text"
            id="companyName"
            value={companyName}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    );
  }