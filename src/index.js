import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import Login from './components/Login';
import GameOver from './components/GameOver';
import backand from './components/common/Backand';
import registerServiceWorker from './registerServiceWorker';
import io from 'socket.io-client';
import './index.css';

window.socket = io('http://localhost:5000');

var ua = navigator.userAgent.toLowerCase();
if (ua.indexOf('safari') !== -1) {
  if (ua.indexOf('chrome') > -1) {
  } else {
    window.alert("Please use chrome.")
  }
}

class Main extends React.Component {

  constructor(){
    super();
    this.state = {
      gameOver: false,
      response: {},
      scores: []
    }
  }

  setSession = (response)=>{
    this.setState({response: response, gameOver: false})
  };

  clearSession = () =>{
    backand.signout().then(()=> console.log('nothing'));
    window.location.reload();
    this.setState({response: {}, gameOver: false})
  };

  closeGame = (scores)=>{
    this.setState({gameOver: true, scores: scores});
  };

  render() {
    if( this.state.response && !this.state.response.access_token ){
      return <Login setSession={this.setSession}/>
    }
    else if (this.state.gameOver){
      return <GameOver userName={this.state.response && this.state.response.firstName} scores={this.state.scores} clearSession={this.clearSession} toggleGame={()=> this.setState({gameOver: !this.state.gameOver})}/>
    }
    else {
      return <App response={this.state.response}
                  userName={this.state.response && this.state.response.firstName}
                  closeGame={this.closeGame}
      />
    }
  }
}

ReactDOM.render(<Main/>, document.getElementById('root'));

registerServiceWorker();
