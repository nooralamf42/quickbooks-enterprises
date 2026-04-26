import React from 'react'

const BrokenLink = () => {
  return (
    <div className='text-center mt-20 text-2xl font-bold '>
      <h2 className='mb-5 text-2xl font-semibold text-red-500'>Broken Link 😢</h2> 
      <img src="/broken.jpg" alt="Broken Link" className='mx-auto' />
    </div>
  )
}

export default BrokenLink