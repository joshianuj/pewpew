import React from 'react';
import TileMap from '../tile-map';
import Frog from '../common/frog';
import Opponents from '../opponents';
import GLOBAL from '../constants';
import backand from '../common/Backand';
import axios from 'axios';
import uuidv1 from 'uuid/v1';


import {
  detectCollision
} from '../utils/geometry';

const ANONYMOUS_TOKEN = 'fb44c3c7-d0ca-40a6-81d1-5bd6484af3be';
axios.defaults.headers.common['AnonymousToken'] = ANONYMOUS_TOKEN;


export default class World extends React.Component {

  constructor(props, context) {
    super(props, context);

    this.state = {
      visibleTileMap: [],
      cameraFocusPoint: {},

      bulletFired: false,

      player: {
        id: uuidv1(),
        name: props.userName,
        relativePosition: {},
        position: {},
        health: 100,
        swordAction: {
          active: false,
          swordDirection: {
            left: 0,
            top: 0
          }
        },
        score: 0
      },

      opponents: {},

    };

    this.screenDimensions = {};
    this.cameraBarrierPoints = {};

    this.setScreenDimensions = this.setScreenDimensions.bind(this);
    this.setScreenDimensions = this.setScreenDimensions.bind(this);
    this.setPlayerPosition = this.setPlayerPosition.bind(this);
    this.checkFrogCollision = this.checkFrogCollision.bind(this);
  }

  componentDidMount() {
    this.connectBackand();
    this.setScreenDimensions({x: 9, y: 5});
    let startingPlayerPosition = {
      x: 2,
      y: 2
    };
    this.setCameraFocus(startingPlayerPosition);
    this.setPlayerPosition(startingPlayerPosition);
  }

  connectBackand = () => {
    axios.post('https://api.backand.com/1/function/general/game', {
      eventName: 'new-player',
      player: this.buildPlayerJson()
    });
    this.setBackandEvents();
  };

  buildPlayerJson = () => {
    return {
      x: this.state.player.position.x,
      y: this.state.player.position.y,
      id: this.state.player.id,
      name: this.state.player.name,
      health: this.state.player.health,
      swdl: this.state.player.swordAction.swordDirection.left,
      swdt: this.state.player.swordAction.swordDirection.top,
      swaa: this.state.player.swordAction.active,
      score: this.state.player.score
    }
  };

  sanitizePlayerJsonData = (data) => {
    let _data = {};
    data[1]['Value'].forEach((d) => {
      _data[d['Key']] = d['Value']
    });
    return {
      health: _data.health,
      position: {
        x: _data.x,
        y: _data.y
      },
      swordAction: {
        active: _data.swaa,
        swordDirection: {
          left: _data.swdl,
          top: _data.swdt
        }
      },
      id: _data.id,
      score: _data.score,
      name: _data.name
    };
  };

  setBackandEvents = () => {
    backand.on('new-player', (data) => {
      let player = this.sanitizePlayerJsonData(data);
      if (player.id === this.state.player.id) {
        return;
      }
      this.state.opponents[player.id] = player;
      this.setState({
        opponents: this.state.opponents
      });

    });
    backand.on('player-update', (data) => {
      let player = this.sanitizePlayerJsonData(data);
      if (player.id === this.state.player.id) {
        return;
      }
      this.state.opponents[player.id] = player;
      this.setState({
        opponents: this.state.opponents
      });
    });
    backand.on('player-hit', (data) => {
      let player = this.sanitizePlayerJsonData(data);
      if (player.id === this.state.player.id) {
        player = this.state.player;
        player.health -= 5;
        if(player.health <= 0) {
          this.props.closeGame();
        }
        return;
      }
      let opponent = this.state.opponents[player.id];
      if (opponent) {
        opponent.health -= 5;
        if (opponent.health <= 0) {
          delete this.state.opponents[player.id];
        } else {
          this.state.opponents[player.id] = opponent;
        }
        this.setState({
          opponents: this.state.opponents
        });
      }
    });
    backand.on('player-use-sword', (data) => {
      let player = this.sanitizePlayerJsonData(data);
      if (player.id === this.state.player.id) {
        return;
      }
      this.state.opponents[player.id] = player;
      this.setState({
        opponents: this.state.opponents
      });
      if (player && player.swordAction.active) {
        setTimeout(() => {
          if (this.state.opponents[player.id]) {
            this.state.opponents[player.id]['swordAction']['active'] = false;
            this.setState({
              opponents: this.state.opponents
            });
          }
        }, 100);
      }

    });
  };

  setPlayerPosition({x, y}) {
    //BOUNDARY LIMIT VALIDATION
    if (x < 0 || x > (this.props.worldMap[0].length - 1) || y < 0 || y > (this.props.worldMap.length - 1)) {
      return;
    }
    let position = {
      x: x,
      y: y
    };
    if (this.checkFrogCollision(position)) {
      return;
    }
    this.setCameraFocus(position);
    this.state.player.position = position;
    this.state.player.relativePosition = {
      x: (position.x - this.state.cameraFocusPoint.x),
      y: (position.y - this.state.cameraFocusPoint.y)
    };
    this.setState({
      player: this.state.player
    });
    axios.post('https://api.backand.com/1/function/general/game', {
      eventName: 'player-update',
      player: this.buildPlayerJson()
    });
  }

  setScreenDimensions({x, y}) {
    this.screenDimensions = {
      x: x,
      y: y,
      xradius: (x - 1) / 2,
      yradius: (y - 1 ) / 2
    };
    this.cameraBarrierPoints = {
      left: this.screenDimensions.xradius,
      right: (this.props.worldMap[0].length - this.screenDimensions.xradius - 1),
      top: this.screenDimensions.yradius,
      bottom: (this.props.worldMap.length - this.screenDimensions.yradius - 1)
    };
  }

  setCameraFocus({x, y}) {
    let cameraFocus = {};
    let cameraBarrierPoints = this.cameraBarrierPoints;

    cameraFocus.x = (x > cameraBarrierPoints.left) ? (x - cameraBarrierPoints.left) : 0;
    cameraFocus.x = (x < cameraBarrierPoints.right) ? cameraFocus.x : (cameraBarrierPoints.right - cameraBarrierPoints.left);
    cameraFocus.y = (y > cameraBarrierPoints.top) ? (y - cameraBarrierPoints.top) : 0;
    cameraFocus.y = (y < cameraBarrierPoints.bottom) ? cameraFocus.y : (cameraBarrierPoints.bottom - cameraBarrierPoints.top);

    this.state.cameraFocusPoint = cameraFocus;
    this.setState({
      cameraFocusPoint: this.state.cameraFocusPoint
    });
  }


  checkFrogCollision({x, y}) {
    let frogDimensions = {
      x: x * GLOBAL.CELL_SIZE,
      y: y * GLOBAL.CELL_SIZE,
      width: (GLOBAL.CELL_SIZE / 4),
      height: (GLOBAL.CELL_SIZE / 4)
    };
    for (let i = 0; i < this.props.worldMap.length; i++) {
      let tileRow = this.props.worldMap[i];
      for (let j = 0; j < tileRow.length; j++) {
        let tileCell = tileRow[j];


        let tileCellObject = tileObject[tileCell];

        if (tileCellObject && tileCellObject.rigid) {
          let tileDimensions = {
            x: (j) * GLOBAL.CELL_SIZE,
            y: (i) * GLOBAL.CELL_SIZE,
            width: GLOBAL.CELL_SIZE,
            height: GLOBAL.CELL_SIZE
          };
          if (detectCollision(tileDimensions, frogDimensions)) {
            return true;
            break;
          }
        }
      }
    }
    return false;
  }

  pewpew({x, y, swordDirection}) {
    let frogDimensions = {
      x: x * GLOBAL.CELL_SIZE,
      y: y * GLOBAL.CELL_SIZE,
      width: (GLOBAL.CELL_SIZE / 4),
      height: (GLOBAL.CELL_SIZE / 4)
    };

    this.state.player.swordAction = {
      active: true,
      swordDirection: swordDirection
    };
    this.setState({
      player: this.state.player
    });

    let _player = this.buildPlayerJson();

    _player.swaa = true;
    axios.post('https://api.backand.com/1/function/general/game', {
      eventName: 'player-use-sword',
      player: _player
    });

    setTimeout(() => {
      this.state.player.swordAction.active = false;
      this.setState({
        player: this.state.player
      });
    }, 100);

    for (let opponentId in this.state.opponents) {
      let opponent = this.state.opponents[opponentId];
      let tileDimensions = {
        x: opponent.position.x * GLOBAL.CELL_SIZE,
        y: opponent.position.y * GLOBAL.CELL_SIZE,
        width: (GLOBAL.CELL_SIZE / 4),
        height: (GLOBAL.CELL_SIZE / 4)
      };
      if (detectCollision(tileDimensions, frogDimensions)) {
        axios.post('https://api.backand.com/1/function/general/game', {
          eventName: 'player-hit',
          player: {
            id: opponentId
          }
        });
        this.state.player.score += 1;
        this.setState({
          player: this.state.player
        });
        axios.post('https://api.backand.com/1/function/general/game', {
          eventName: 'player-update',
          player: this.buildPlayerJson()
        });
        return false;
      }
    }
  }

  getWorldStyle = () => {
    return {
      height: this.screenDimensions.y * GLOBAL.CELL_SIZE,
      width: this.screenDimensions.x * GLOBAL.CELL_SIZE
    }
  };

  getScores = () => {
    let scores = [];
    scores.push({
      owner: this.state.player.name,
      value: this.state.player.score
    });
    Object.keys(this.state.opponents).map((opponentKey, index) => {
      let opponent = this.state.opponents[opponentKey];
      scores.push({
        owner: opponent.name,
        value: opponent.score
      });
    });
    return scores;
  };

  render() {
    return (
      <div className="world-container" style={this.getWorldStyle()}>
        <TileMap tileMap={this.props.worldMap}
                 cameraPosition={this.state.cameraFocusPoint}/>
        <Frog player={this.state.player}
              pewpew={this.pewpew.bind(this)}
              setPlayerPosition={this.setPlayerPosition}/>
        {
          Object.keys(this.state.opponents).map((opponentKey, index) =>
            <Opponents key={index} cameraFocusPoint={this.state.cameraFocusPoint}
                       index={index} opponent={this.state.opponents[opponentKey]}/>
          )
        }
        <table>
          <tbody>
          {
            this.getScores().map((score) => {
              return (
                <tr>
                  <td>{score.owner}</td>
                  <td>{score.value}</td>
                </tr>)
            })
          }
          </tbody>
        </table>
      </div>
    )
  }
}

const tileObject = {
  0: {},
  1: {},
  2: {
    rigid: true
  },
  3: {
    rigid: true
  },
  5: {
    rigid: true
  }
};
