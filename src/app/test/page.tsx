export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-blue-600 mb-4">Tailwind CSS Test</h1>
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <p className="text-gray-700 mb-4">If you can see this styled properly, Tailwind is working!</p>
        <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Test Button
        </button>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="bg-red-200 p-4 rounded">Red</div>
        <div className="bg-green-200 p-4 rounded">Green</div>
        <div className="bg-blue-200 p-4 rounded">Blue</div>
      </div>
    </div>
  )
}